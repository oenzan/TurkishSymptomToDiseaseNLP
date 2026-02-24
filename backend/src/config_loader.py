import os
import yaml
from pathlib import Path
from dotenv import load_dotenv

# ===========================
# 1. Environment & Base Paths
# ===========================

current_file_path = Path(__file__).resolve()
project_root = current_file_path.parent.parent  # Points to 'backend' folder
actual_project_root = project_root.parent  # Points to actual project root (SourceCode)

# Load .env file from actual project root
env_path = actual_project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ Loaded .env from: {env_path}")
else:
    # Fallback: try backend folder
    env_path_fallback = project_root / ".env"
    if env_path_fallback.exists():
        load_dotenv(env_path_fallback)
        print(f"✅ Loaded .env from: {env_path_fallback}")
    else:
        print(f"⚠️ No .env file found at {env_path} or {env_path_fallback}")

class ProjectConfig:
    """
    Central configuration management using config.yaml.
    """
    def __init__(self, config_file="config.yaml"):
        self.backend_root = project_root
        config_path = self.backend_root / config_file

        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found at: {config_path}")

        # YAML dosyasını oku
        with open(config_path, 'r', encoding='utf-8') as f:
            self.cfg = yaml.safe_load(f)

    # ===========================
    # 2. Model Getters (From YAML)
    # ===========================

    @property
    def llm_model_name(self):
        return self.cfg['models']['llm']

    @property
    def temperature(self):
        return self.cfg['parameters']['temperature']

    # ===========================
    # 3. API Key
    # ===========================

    def get_hf_token(self):
        key = os.getenv("HF_TOKEN")
        if not key:
            raise ValueError("HF_TOKEN not found in .env file.")
        return key

# ===========================
# Singleton Instance
# ===========================
config = ProjectConfig()

if __name__ == "__main__":
    # Run this file to test configuration loading
    print(f"Backend Root: {config.backend_root}")
    print(f"Loading config from: config.yaml")
    print(f"\n--- Parameters ---")
    print(f"LLM Model: {config.llm_model_name}")
    print(f"Temperature: {config.temperature}")
