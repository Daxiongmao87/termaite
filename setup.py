"""
Setup script for termaite package.
"""

from setuptools import setup, find_packages

# Read the contents of README file
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="termaite",
    version="0.1.0",
    author="Termaite Team",
    author_email="contact@termaite.dev",
    description="A Python-based terminal agent that uses bash commands as tool calls",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/termaite/termaite",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: System :: Shells",
        "Topic :: Terminals",
        "Topic :: Utilities",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
        "toml>=0.10.2",
    ],
    extras_require={
        "dev": [
            "pytest>=6.0",
            "pytest-cov>=2.0",
            "black>=21.0",
            "flake8>=3.8",
            "mypy>=0.812",
        ],
    },
    entry_points={
        "console_scripts": [
            "termaite=termaite.__main__:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
    keywords="terminal agent bash commands llm ai automation",
    project_urls={
        "Bug Reports": "https://github.com/termaite/termaite/issues",
        "Source": "https://github.com/termaite/termaite",
        "Documentation": "https://docs.termaite.dev",
    },
)