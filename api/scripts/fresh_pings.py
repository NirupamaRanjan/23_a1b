"""Compatibility launcher; database tooling lives in root data_generation/."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from data_generation.fresh_pings import main

if __name__ == '__main__':
    main()
