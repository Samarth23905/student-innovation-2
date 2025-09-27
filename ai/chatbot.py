import sys
from transformers import pipeline

message = sys.argv[1]
user_type = sys.argv[2] if len(sys.argv) > 2 else "Student"

# Use text-generation pipeline with DialoGPT-medium
chatbot = pipeline("text-generation", model="microsoft/DialoGPT-medium")
response = chatbot(message, max_length=100)[0]['generated_text']
print(response)