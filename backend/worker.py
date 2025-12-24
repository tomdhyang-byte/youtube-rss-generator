#!/usr/bin/env python3
"""
YouTube RSS Generator Worker
Entry point for processing YouTube channels and Podcasts.

This script imports and runs the worker from the modularized worker/ package.
"""

from worker import main

if __name__ == "__main__":
    main()
