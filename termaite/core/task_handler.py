"""Task handler with Plan-Act-Evaluate loop for termaite."""

import hashlib
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional, Tuple

from ..commands import (
    create_command_executor,
    create_permission_manager,
    create_safety_checker,
)
from ..constants import CLR_BOLD_GREEN, CLR_GREEN, CLR_RESET
from ..llm import (
    create_llm_client,
    create_payload_builder,
    parse_llm_decision,
    parse_llm_instruction,
    parse_llm_plan,
    parse_llm_summary,
    parse_llm_thought,
    parse_suggested_command,
    parse_definition_of_done,
)
from ..utils.logging import logger
from .context_compactor import create_context_compactor


class TaskStatus(Enum):
    """Task execution status."""

    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AgentPhase(Enum):
    """Agent execution phases."""

    PLAN = "plan"
    ACTION = "action"
    EVALUATE = "evaluate"


@dataclass
class TaskState:
    """Current state of task execution."""

    current_plan: str = ""
    current_instruction: str = ""
    plan_array: list[str] = None
    step_index: int = 0
    last_action_taken: str = ""
    last_action_result: str = ""
    user_clarification: str = ""
    last_eval_decision: str = ""
    iteration: int = 0
    definition_of_done: str = ""

    # Agent summaries for inter-agent coordination
    planner_summary: str = ""
    actor_summary: str = ""
    evaluator_summary: str = ""

    def __post_init__(self):
        if self.plan_array is None:
            self.plan_array = []


class TaskHandler:
    """Handles task execution through the Plan-Act-Evaluate loop."""

    def __init__(
        self,
        config: Dict[str, Any],
        config_manager,
        initial_working_directory: Optional[str] = None,
    ):
        """Initialize the task handler.

        Args:
            config: Application configuration
            config_manager: Configuration manager instance
            initial_working_directory: The working directory where the application was started
        """
        self.config = config
        self.config_manager = config_manager
        self.initial_working_directory = initial_working_directory

        # Initialize components
        self.llm_client = create_llm_client(config, config_manager)
        self.payload_builder = create_payload_builder(
            config, config_manager.payload_file, initial_working_directory
        )
        self.command_executor = create_command_executor(
            config.get("command_timeout", 30),
            working_directory=initial_working_directory,
        )
        self.permission_manager = create_permission_manager(config_manager.config_file)
        self.safety_checker = create_safety_checker()
        self.context_compactor = create_context_compactor(config, config_manager)

        # Set command maps from config
        allowed_cmds, blacklisted_cmds = config_manager.get_command_maps()
        self.payload_builder.set_command_maps(allowed_cmds, blacklisted_cmds)
        self.permission_manager.set_command_maps(allowed_cmds, blacklisted_cmds)

        logger.debug("TaskHandler initialized")

    def handle_task(self, user_prompt: str) -> Tuple[bool, str]:
        """Handle a complete task through Plan-Act-Evaluate loop.

        Args:
            user_prompt: Initial user request

        Returns:
            A tuple containing:
            - True if task completed successfully, False otherwise
            - The final context string of the task execution
        """
        # Initialize task state
        state = TaskState()
        task_status = TaskStatus.IN_PROGRESS
        current_context = user_prompt

        # Main Plan-Act-Evaluate loop
        while task_status == TaskStatus.IN_PROGRESS:
            state.iteration += 1

            # Determine if we need a new plan
            needs_new_plan = (
                not state.current_plan
                or state.last_eval_decision == "REVISE_PLAN"
                or state.last_eval_decision == "CONTINUE_PLAN"
                or (
                    state.user_clarification
                    and state.last_eval_decision in ["CLARIFY_USER", "PLANNER_CLARIFY"]
                )
            )

            if needs_new_plan:
                task_status = self._execute_plan_phase(current_context, state)
                if task_status != TaskStatus.IN_PROGRESS:
                    break
                current_context = self._build_action_context(user_prompt, state)

            # Execute action phase
            if not state.current_instruction:
                logger.error("ACTION phase: No current instruction")
                task_status = TaskStatus.FAILED
                break

            task_status = self._execute_action_phase(current_context, state)
            if task_status != TaskStatus.IN_PROGRESS:
                break

            # Execute evaluation phase
            eval_context = self._build_evaluation_context(user_prompt, state)
            task_status, current_context = self._execute_evaluation_phase(
                eval_context, state, user_prompt
            )

        # Return final result
        if task_status == TaskStatus.COMPLETED:
            logger.user("Task completed successfully.")
            # Generate completion summary
            self._generate_completion_summary(user_prompt, state)
            final_context = self._build_evaluation_context(user_prompt, state)
            return True, final_context
        else:
            logger.user("Task failed or was aborted.")
            final_context = self._build_evaluation_context(user_prompt, state)
            return False, final_context

    def _execute_plan_phase(self, context: str, state: TaskState) -> TaskStatus:
        """Execute the planning phase with retry logic for parsing."""
        attempt = 0
        while True:
            attempt += 1
            # Compact context before LLM call
            pwd_hash = hashlib.sha256(os.getcwd().encode("utf-8")).hexdigest()
            self.context_compactor.check_and_compact_context(pwd_hash)
            
            # Get LLM response for planning
            payload = self.payload_builder.prepare_payload("plan", context)
            if not payload:
                logger.error("Failed to prepare payload for PLAN phase")
                return TaskStatus.FAILED

            response = self.llm_client.send_request(payload)
            if not response:
                logger.error("No response from LLM for PLAN phase")
                return TaskStatus.FAILED

            # Append to context for history
            self.config_manager.append_context(
                f"Planner Input (Attempt {attempt + 1}): {context}", response
            )

            # Parse LLM response
            thought = parse_llm_thought(response)
            if thought:
                logger.plan_agent(f"[Planner Thought]: {thought}")

            decision = parse_llm_decision(response)
            if decision.startswith("CLARIFY_USER:"):
                if self.config.get("allow_clarifying_questions", True):
                    clarification_question = decision.split(":", 1)[1].strip()
                    logger.plan_agent(
                        f"[Planner Clarification]: {clarification_question}"
                    )
                    print(f"\n{CLR_BOLD_GREEN}{clarification_question}{CLR_RESET}")
                    print(f"{CLR_GREEN}Response: {CLR_RESET}", end="")
                    state.user_clarification = input()
                    state.last_eval_decision = "PLANNER_CLARIFY"
                    state.current_plan = ""
                    return TaskStatus.IN_PROGRESS
                else:
                    logger.warning(
                        "Plan Agent attempted CLARIFY_USER when questions disabled"
                    )
                    # Treat as a format failure to trigger retry
                    context = (
                        f"{context}\n\nPREVIOUS ATTEMPT FAILED. "
                        "Your last response requested user clarification, which is disabled. "
                        "Please generate a plan without asking questions."
                    )
                    continue

            # Extract plan, instruction, summary, and definition of done
            state.current_plan = parse_llm_plan(response)
            state.current_instruction = parse_llm_instruction(response)
            state.planner_summary = parse_llm_summary(response)
            state.definition_of_done = parse_definition_of_done(response)

            # Validate plan and instruction
            if state.current_plan and state.current_instruction:
                if state.planner_summary:
                    logger.plan_agent(f"[Planner Summary]: {state.planner_summary}")
                if state.definition_of_done:
                    logger.plan_agent(f"[Definition of Done]: {state.definition_of_done}")
                logger.plan_agent(f"[Planner Checklist]:\n{state.current_plan}")
                logger.plan_agent(f"[Next Instruction]: {state.current_instruction}")

                state.plan_array = [
                    line.strip()
                    for line in state.current_plan.splitlines()
                    if line.strip()
                ]
                state.step_index = 0
                state.user_clarification = ""
                state.last_eval_decision = ""
                return TaskStatus.IN_PROGRESS

            # If validation fails, prepare for retry
            error_messages = []
            if not state.current_plan:
                error_messages.append(
                    "Response did not contain a valid `<checklist>...</checklist>` block."
                )
            if not state.current_instruction:
                error_messages.append(
                    "Response did not contain a valid `<instruction>...</instruction>` block."
                )
            error_message = " ".join(error_messages)

            logger.warning(
                f"Planner failed to provide required output (Attempt {attempt}). "
                f"Reason: {error_message} Response: {response}"
            )

            context = f"""<correction_request>
<error>
<type>Invalid Response Format</type>
<message>Your previous response was malformed and did not follow the required structure.</message>
<details>{error_message}</details>
</error>
<instruction>
You MUST correct your output. Your response MUST contain BOTH a `<checklist>...</checklist>` block AND an `<instruction>...</instruction>` block. This is not optional. Failure to comply will result in task termination.
</instruction>
<original_context>
{context}
</original_context>
</correction_request>"""

    def _execute_action_phase(self, context: str, state: TaskState) -> TaskStatus:
        """Execute the action phase with retry logic for command parsing."""
        attempt = 0
        while True:
            attempt += 1
            # Compact context before LLM call
            pwd_hash = hashlib.sha256(os.getcwd().encode("utf-8")).hexdigest()
            self.context_compactor.check_and_compact_context(pwd_hash)
            
            # Get LLM response for action
            payload = self.payload_builder.prepare_payload("action", context)
            if not payload:
                logger.error("Failed to prepare payload for ACTION phase")
                return TaskStatus.FAILED

            response = self.llm_client.send_request(payload)
            if not response:
                logger.error("No response from LLM for ACTION phase")
                return TaskStatus.FAILED

            # Append to context for history
            self.config_manager.append_context(
                f"Actor Input (Attempt {attempt}): {context}", response
            )

            # Parse LLM response
            thought = parse_llm_thought(response)
            if thought:
                logger.action_agent(f"[Actor Thought]: {thought}")

            state.actor_summary = parse_llm_summary(response)
            if state.actor_summary:
                logger.action_agent(f"[Actor Summary]: {state.actor_summary}")

            suggested_command = parse_suggested_command(response)

            if suggested_command:
                return self._handle_command_suggestion(suggested_command, state)

            # If no command, prepare for retry
            error_message = (
                "Action agent response did not contain a valid `<command>...</command>` block. "
                "This is a format violation. You MUST provide a command."
            )
            logger.warning(
                f"Action agent failed to provide a command (Attempt {attempt}). "
                f"Response: {response}"
            )
            # Display the failure to the user
            print(
                f"\n{CLR_BOLD_GREEN}[Warning] Action agent failed to provide a command (Attempt {attempt}){CLR_RESET}"
            )
            print(f"{CLR_GREEN}Response: {response}{CLR_RESET}\n")

            # Re-prompt with corrective feedback
            context = (
                f"{context}\n\nPREVIOUS ATTEMPT FAILED. "
                f"Your last response was invalid. Reason: {error_message}\n"
                "Please correct your response and provide a valid command."
            )

    def _handle_command_suggestion(self, command: str, state: TaskState) -> TaskStatus:
        """Handle a command suggestion from the action agent."""
        if command == "report_task_completion":
            logger.action_agent(
                "Received 'report_task_completion'. Signaling to Evaluator."
            )
            state.last_action_taken = "Internal signal: report_task_completion"
            state.last_action_result = (
                "Action Agent determined task is complete and signaled Evaluator."
            )
            return TaskStatus.IN_PROGRESS

        # Check command permissions
        operation_mode = self.config.get("operation_mode", "normal")
        allowed, reason = self.permission_manager.check_command_permission(
            command, operation_mode
        )

        if not allowed:
            if operation_mode == "normal":
                state.last_action_taken = f"Command '{command}' not executed."
                state.last_action_result = f"Command blocked: {reason}"
                return TaskStatus.IN_PROGRESS
            elif operation_mode in ["gremlin", "goblin"]:
                # Handle dynamic permission requests
                if operation_mode == "goblin":
                    logger.system("Goblin Mode: Auto-allowing command")
                    allowed = True
                else:  # gremlin mode
                    (
                        decision,
                        perm_reason,
                    ) = self.permission_manager.prompt_for_permission(
                        command, self.config, self.llm_client
                    )
                    if decision == 0:
                        allowed = True
                    elif decision == 2:  # Cancel task
                        return TaskStatus.CANCELLED
                    else:
                        state.last_action_taken = f"Command '{command}' denied by user"
                        state.last_action_result = (
                            f"User denied permission: {perm_reason}"
                        )
                        return TaskStatus.IN_PROGRESS

        if allowed:
            # Confirm execution in normal mode
            if operation_mode == "normal":
                print(
                    f"{CLR_GREEN}User:{CLR_RESET}{CLR_BOLD_GREEN} Execute? {CLR_RESET}'{command}'{CLR_BOLD_GREEN} [y/N]: {CLR_RESET}",
                    end="",
                )
                if input().lower() != "y":
                    state.last_action_taken = f"Command '{command}' cancelled by user"
                    state.last_action_result = "User cancelled at confirmation"
                    return TaskStatus.IN_PROGRESS

            # Execute the command
            logger.system(f"Executing command: {command}")
            result = self.command_executor.execute(command)

            state.last_action_taken = f"Executed command: {command}"
            state.last_action_result = f"Exit Code: {result.exit_code}. Output:\n{result.output or '(no output)'}"

            logger.system(f"Command result: {state.last_action_result}")

        return TaskStatus.IN_PROGRESS

    def _execute_evaluation_phase(
        self, context: str, state: TaskState, original_prompt: str
    ) -> tuple[TaskStatus, str]:
        """Execute the evaluation phase with retry logic for parsing."""
        attempt = 0
        current_context = context
        while True:
            attempt += 1
            # Compact context before LLM call
            pwd_hash = hashlib.sha256(os.getcwd().encode("utf-8")).hexdigest()
            self.context_compactor.check_and_compact_context(pwd_hash)
            
            # Get LLM response for evaluation
            payload = self.payload_builder.prepare_payload("evaluate", current_context)
            if not payload:
                logger.error("Failed to prepare payload for EVALUATION phase")
                return TaskStatus.FAILED, ""

            response = self.llm_client.send_request(payload)
            if not response:
                logger.error("No response from LLM for EVALUATION phase")
                return TaskStatus.FAILED, ""

            # Append to context for history
            self.config_manager.append_context(
                f"Evaluator Input (Attempt {attempt}): {current_context}", response
            )

            # Parse LLM response
            thought = parse_llm_thought(response)
            if thought:
                logger.eval_agent(f"[Evaluator Thought]: {thought}")

            state.evaluator_summary = parse_llm_summary(response)
            if state.evaluator_summary:
                logger.eval_agent(f"[Evaluator Summary]: {state.evaluator_summary}")

            decision = parse_llm_decision(response)
            if decision:
                logger.eval_agent(f"[Evaluator Decision]: {decision}")
                from ..llm.parsers import extract_decision_type_and_message

                decision_type, message = extract_decision_type_and_message(decision)
                state.last_eval_decision = decision_type
                return self._process_evaluation_decision(
                    decision_type, message, state, original_prompt
                )

            # If no decision, prepare for retry
            error_message = (
                "Response did not contain a valid `<decision>...</decision>` block."
            )
            logger.warning(
                f"Evaluator failed to provide a decision (Attempt {attempt}). "
                f"Reason: {error_message} Response: {response}"
            )

            current_context = (
                f"{context}\n\nPREVIOUS ATTEMPT FAILED. "
                f"Your last response was invalid. Reason: {error_message}\n"
                "Please correct your response and provide a valid decision."
            )

    def _process_evaluation_decision(
        self, decision_type: str, message: str, state: TaskState, original_prompt: str
    ) -> tuple[TaskStatus, str]:
        """Process the evaluator's decision and return next status and context."""
        if decision_type == "TASK_COMPLETE":
            logger.eval_agent(f"Task marked COMPLETE by evaluator: {message}")
            return TaskStatus.COMPLETED, ""

        elif decision_type == "TASK_FAILED":
            logger.eval_agent(f"Task marked FAILED by evaluator. Reason: {message}")
            return TaskStatus.FAILED, ""

        elif decision_type == "CONTINUE_PLAN":
            logger.eval_agent(f"Evaluator: CONTINUE_PLAN. {message}")
            state.step_index += 1
            
            # Build context for the planning phase to get next instruction
            next_context = (
                f"Original request: '{original_prompt}'.\n"
                f"Current plan:\n{state.current_plan}\n"
                f"Previous instruction ('{state.current_instruction}') was completed successfully.\n"
                f"Result: '{state.last_action_result}'.\n"
                f"Evaluator says: '{message}'.\n"
                f"Provide the next instruction from the plan for step {state.step_index + 1}."
            )
            state.user_clarification = ""  # Clear user clarification after use
            return TaskStatus.IN_PROGRESS, next_context

        elif decision_type == "REVISE_PLAN":
            logger.eval_agent(f"Evaluator: REVISE_PLAN. Reason: {message}")
            next_context = (
                f"Original request: '{state.current_instruction}'.\n"
                f"Prev plan:\n{state.current_plan}\n"
                f"Prev instruction ('{state.current_instruction}') result: '{state.last_action_result}'.\n"
                f"Evaluator suggests revision: '{message}'.\n"
                "Revise checklist and provide new first instruction."
            )
            # Reset for new plan
            state.current_plan = ""
            state.current_instruction = ""
            state.user_clarification = ""
            return TaskStatus.IN_PROGRESS, next_context

        elif decision_type == "CLARIFY_USER":
            if self.config.get("allow_clarifying_questions", True):
                logger.eval_agent(f"[Evaluator Clarification]: {message}")
                print(f"\n{CLR_BOLD_GREEN}{message}{CLR_RESET}")
                print(f"{CLR_GREEN}Response: {CLR_RESET}", end="")
                state.user_clarification = input()
                next_context = (
                    f"Original request: '{state.current_instruction}'.\n"
                    f"After action '{state.last_action_taken}' (result: '{state.last_action_result}'), "
                    f"evaluator needs clarification. Question: '{message}'.\n"
                    f"User's answer: '{state.user_clarification}'.\n"
                    "Revise plan/next instruction based on this."
                )
                # Reset for revision
                state.current_plan = ""
                state.current_instruction = ""
                return TaskStatus.IN_PROGRESS, next_context
            else:
                logger.warning(
                    f"Evaluator: CLARIFY_USER when questions disabled: '{message}'"
                )
                logger.system(
                    "Task FAILED: evaluator needs clarification, questions disabled"
                )
                return TaskStatus.FAILED, ""

        elif decision_type == "VERIFY_ACTION":
            logger.eval_agent(f"Evaluator requests verification: {message}")
            # Set the verification command as the next instruction
            verification_context = (
                f"Original request: '{state.current_instruction}'.\n"
                f"Previous action: '{state.last_action_taken}' (result: '{state.last_action_result}').\n"
                f"Evaluator needs verification. Execute this command to verify the outcome: {message}"
            )
            # Keep the same plan but set verification as next instruction
            state.current_instruction = f"Execute verification command: {message}"
            state.user_clarification = ""
            return TaskStatus.IN_PROGRESS, verification_context

        else:
            logger.error(
                f"Unknown decision from Evaluator: '{decision_type}'. Assuming task failed"
            )
            return TaskStatus.FAILED, ""

    def _build_action_context(self, original_prompt: str, state: TaskState) -> str:
        """Build context for action phase."""
        context = (
            f"User's original request: '{original_prompt}'\n\n"
            f"Instruction to execute: '{state.current_instruction}'"
        )

        # Add planner summary for coordination
        if state.planner_summary:
            context += f"\n\nPlanner's Summary: {state.planner_summary}"

        if state.user_clarification:
            context += f"\n\nContext: User responded '{state.user_clarification}' to my last question."
            state.user_clarification = ""  # Clear after use
        return context

    def _build_evaluation_context(self, original_prompt: str, state: TaskState) -> str:
        """Build context for evaluation phase."""
        context = (
            f"User's original request: '{original_prompt}'\n\n"
            f"Current Plan Checklist (if available):\n{state.current_plan}\n\n"
        )
        
        # Add definition of done for task completion criteria
        if state.definition_of_done:
            context += f"Definition of Done for this task:\n{state.definition_of_done}\n\n"
            
        context += (
            f"Instruction that was attempted: '{state.current_instruction}'\n\n"
            f"Action Taken by Actor:\n{state.last_action_taken}\n\n"
            f"Result of Action:\n{state.last_action_result}"
        )

        # Add agent summaries for coordination
        if state.planner_summary:
            context += f"\n\nPlanner's Summary: {state.planner_summary}"
        if state.actor_summary:
            context += f"\n\nActor's Summary: {state.actor_summary}"

        if state.user_clarification:
            context += f"\n\nContext: User responded '{state.user_clarification}' to my last question."
            state.user_clarification = ""  # Clear after use
        return context

    def _generate_completion_summary(self, original_prompt: str, state: TaskState):
        """Generate and display a completion summary after task success."""
        logger.system("Generating task completion summary...")

        # Build context for summary generation
        context_history = self.config_manager.get_current_session_context()
        summary_context = (
            f"Original User Request: '{original_prompt}'\n\n"
            f"Task Execution History:\n{context_history}\n\n"
            f"Final Task State:\n"
            f"- Plan: {state.current_plan}\n"
            f"- Last Action: {state.last_action_taken}\n"
            f"- Result: {state.last_action_result}\n"
            f"- Total Iterations: {state.iteration}"
        )

        # Compact context before LLM call
        pwd_hash = hashlib.sha256(os.getcwd().encode("utf-8")).hexdigest()
        self.context_compactor.check_and_compact_context(pwd_hash)
        
        # Get completion summary from LLM
        payload = self.payload_builder.prepare_payload(
            "completion_summary", summary_context
        )
        if not payload:
            logger.warning("Failed to prepare payload for completion summary")
            return

        response = self.llm_client.send_request(payload)
        if not response:
            logger.warning("No response from LLM for completion summary")
            return

        # Parse and display the summary
        try:
            # Extract the summary content from between <summary> tags

            summary_match = re.search(r"<summary>(.*?)</summary>", response, re.DOTALL)
            if summary_match:
                summary_content = summary_match.group(1).strip()
                print(f"\n{summary_content}\n")
            else:
                # If no summary tags, just display the response directly
                print(f"\n## Task Completion Summary\n{response}\n")
        except Exception as e:
            logger.warning(f"Error parsing completion summary: {e}")
            print(f"\n## Task Completion Summary\n{response}\n")


def create_task_handler(
    config: Dict[str, Any],
    config_manager,
    initial_working_directory: Optional[str] = None,
) -> TaskHandler:
    """Create a task handler instance.

    Args:
        config: Application configuration
        config_manager: Configuration manager instance
        initial_working_directory: The working directory where the application was started

    Returns:
        TaskHandler instance
    """
    return TaskHandler(config, config_manager, initial_working_directory)
