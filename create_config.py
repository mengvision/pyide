import json
from pathlib import Path

config = {
    "mcpServers": {
        "datahub": {
            "command": "uvx",
            "args": ["mcp-server-datahub@latest"],
            "env": {
                "DATAHUB_GMS_URL": "http://192.168.38.121:8080",
                "DATAHUB_GMS_TOKEN": "eyJhbGciOiJIUzI1NiJ9.eyJhY3RvclR5cGUiOiJVU0VSIiwiYWN0b3JJZCI6Im1lbmdzaGlxdWFuQGFuZ2VsYWxpZ24uY29tIiwidHlwZSI6IlBFUlNPTkFMIiwidmVyc2lvbiI6IjIiLCJqdGkiOiIyMzY2NzAzMS0zODI2LTRiNjYtOTEyMi1hMWVkNWJlOTE1OTAiLCJzdWIiOiJtZW5nc2hpcXVhbkBhbmdlbGFsaWduLmNvbSIsImlzcyI6ImRhdGFodWItbWV0YWRhdGEtc2VydmljZSJ9.uCuYc-W8ksQuzfkOPRGvxojtq8QblBRIJgNs0mQ7rL4"
            }
        }
    }
}

config_path = Path.home() / '.pyide' / 'mcp_config.json'
config_path.parent.mkdir(exist_ok=True)

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print(f"✅ Config file created successfully at: {config_path}")
print(f"\nConfig content:")
print(json.dumps(config, indent=2, ensure_ascii=False))
