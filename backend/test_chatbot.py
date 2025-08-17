#!/usr/bin/env python3
"""
Quick test script for chatbot endpoints
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def test_health():
    """Test general health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Health status: {response.status_code}")
        print(f"Health response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_chatbot_health():
    """Test chatbot health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/chatbot-health", timeout=10)
        print(f"Chatbot health status: {response.status_code}")
        print(f"Chatbot health response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Chatbot health check failed: {e}")
        return False

def test_chatbot_sync():
    """Test chatbot sync endpoint"""
    try:
        data = {"text": "Hello, this is a test message"}
        response = requests.post(
            f"{BASE_URL}/chatbot-sync", 
            json=data,
            timeout=30
        )
        print(f"Chatbot sync status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Chatbot response: {result.get('response', '')[:100]}...")
        else:
            print(f"Error response: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Chatbot sync test failed: {e}")
        return False

def test_chatbot_streaming():
    """Test chatbot streaming endpoint"""
    try:
        data = {"text": "What can you help me with?"}
        response = requests.post(
            f"{BASE_URL}/chatbot",
            json=data,
            stream=True,
            timeout=30
        )
        print(f"Chatbot streaming status: {response.status_code}")
        
        if response.status_code == 200:
            print("Streaming response:")
            content = ""
            for chunk in response.iter_content(chunk_size=1, decode_unicode=True):
                if chunk:
                    content += chunk
                    print(chunk, end='', flush=True)
            print("\n" + "="*50)
            print(f"Total response length: {len(content)} characters")
        else:
            print(f"Error response: {response.text}")
        
        return response.status_code == 200
    except Exception as e:
        print(f"Chatbot streaming test failed: {e}")
        return False

def main():
    print("Testing chatbot endpoints...")
    print("="*50)
    
    # Test basic connectivity
    print("1. Testing general health...")
    if not test_health():
        print("❌ Server not responding. Make sure backend is running on port 8000")
        sys.exit(1)
    print("✅ Server is running")
    
    print("\n2. Testing chatbot health...")
    if not test_chatbot_health():
        print("❌ Chatbot health check failed")
        sys.exit(1)
    print("✅ Chatbot service is healthy")
    
    print("\n3. Testing chatbot sync endpoint...")
    if not test_chatbot_sync():
        print("❌ Chatbot sync test failed")
        sys.exit(1)
    print("✅ Chatbot sync working")
    
    print("\n4. Testing chatbot streaming endpoint...")
    if not test_chatbot_streaming():
        print("❌ Chatbot streaming test failed")
        sys.exit(1)
    print("✅ Chatbot streaming working")
    
    print("\n" + "="*50)
    print("✅ All chatbot tests passed!")

if __name__ == "__main__":
    main()
