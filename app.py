from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import os

app = Flask(__name__)
CORS(app)

print("🔄 Loading TinyLlama model...")
model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token

device = "cuda" if torch.cuda.is_available() else "cpu"
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    device_map="auto"
)
print(f"✅ Model loaded on {device.upper()}!")

conversations = {}

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        session_id = data.get('session_id', 'default')
        
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        if session_id not in conversations:
            conversations[session_id] = []
        
        if len(conversations[session_id]) > 20:
            conversations[session_id] = conversations[session_id][-20:]
        
        history = "".join(conversations[session_id])
        prompt = f"<|system|>\nYou are a helpful assistant.</s>\n{history}<|user|>\n{user_message}</s>\n<|assistant|>\n"
        
        inputs = tokenizer(prompt, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.to('cuda') for k, v in inputs.items()}
        
        outputs = model.generate(
            **inputs,
            max_new_tokens=200,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id
        )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response.split("<|assistant|>\n")[-1].strip()
        
        conversations[session_id].append(f"<|user|>\n{user_message}</s>\n<|assistant|>\n{response}</s>\n")
        
        return jsonify({"response": response, "success": True})
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "model": model_name,
        "gpu_available": torch.cuda.is_available()
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)