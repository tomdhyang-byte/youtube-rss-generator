import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.getenv('OPENAI_API_KEY')

if not api_key:
    print("Error: OPENAI_API_KEY not found in environment variables.")
    exit(1)

print(f"API Key found: {api_key[:5]}...{api_key[-4:]}")

try:
    client = OpenAI(api_key=api_key)
    print("Sending test request to OpenAI...")
    
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "user", "content": "Hello, are you working?"}
        ],
        max_tokens=10
    )
    
    print("Response received:")
    print(response.choices[0].message.content)
    print("\nSUCCESS: OpenAI API key is working!")
    
except Exception as e:
    print(f"\nERROR: Failed to connect to OpenAI API.\nDetails: {e}")
