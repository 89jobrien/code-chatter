#!/usr/bin/env python3
"""
Diagnostic script to check Azure OpenAI configuration
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_environment_variables():
    """Check if all required environment variables are set"""
    required_vars = [
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_KEY", 
        "AZURE_OPENAI_API_VERSION",
        "AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"
    ]
    
    print("🔍 Checking Environment Variables:")
    print("=" * 50)
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if not value or value.lower() == 'none':
            print(f"❌ {var}: NOT SET")
            missing_vars.append(var)
        else:
            # Mask API key for security
            if "API_KEY" in var:
                masked_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
                print(f"✅ {var}: {masked_value}")
            else:
                print(f"✅ {var}: {value}")
    
    if missing_vars:
        print(f"\n❌ Missing environment variables: {', '.join(missing_vars)}")
        print("\nPlease set these in your .env file or environment:")
        for var in missing_vars:
            print(f"export {var}=your_value_here")
        return False
    else:
        print("\n✅ All required environment variables are set!")
        return True

def test_azure_openai_connection():
    """Test Azure OpenAI connection"""
    try:
        from langchain_openai import AzureChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        from pydantic import SecretStr
        
        print("\n🔗 Testing Azure OpenAI Connection:")
        print("=" * 50)
        
        # Get environment variables
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION") 
        deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME")
        
        print(f"Endpoint: {endpoint}")
        print(f"API Version: {api_version}")
        print(f"Deployment: {deployment}")
        
        # Create client
        llm = AzureChatOpenAI(
            streaming=False,
            api_key=SecretStr(api_key),
            azure_deployment=deployment,
            azure_endpoint=endpoint,
            api_version=api_version,
            # Note: gpt-5-mini (GPT-4o-mini) only supports default temperature
        )
        
        # Test simple message
        print("\n📝 Sending test message...")
        messages = [
            SystemMessage(content="You are a test assistant."),
            HumanMessage(content="Reply with exactly 'Connection successful!'")
        ]
        
        result = llm.invoke(messages)
        print(f"✅ Response received: {result.content}")
        print("✅ Azure OpenAI connection is working!")
        return True
        
    except Exception as e:
        print(f"❌ Azure OpenAI connection failed: {str(e)}")
        
        # Provide specific guidance based on error
        error_str = str(e).lower()
        print("\n🔧 Troubleshooting:")
        
        if "404" in error_str or "resource not found" in error_str:
            print("- Check that your deployment name is correct")
            print("- Verify the endpoint URL is correct")
            print("- Ensure the deployment exists in your Azure OpenAI resource")
            print("- Check that the API version matches your deployment")
            
        elif "401" in error_str or "unauthorized" in error_str:
            print("- Verify your API key is correct")
            print("- Check that the API key hasn't expired")
            print("- Ensure you have permission to access the resource")
            
        elif "timeout" in error_str:
            print("- Check your internet connection")
            print("- Verify the endpoint URL is accessible")
            
        else:
            print(f"- General error: {str(e)}")
            
        return False

def suggest_common_fixes():
    """Suggest common configuration fixes"""
    print("\n💡 Common Configuration Issues:")
    print("=" * 50)
    print("1. Deployment Name: Should match exactly what you see in Azure Portal")
    print("   Example: 'gpt-35-turbo' or 'gpt-4'")
    print("\n2. Endpoint URL: Should end with .openai.azure.com/")
    print("   Example: 'https://your-resource.openai.azure.com/'")
    print("\n3. API Version: Use a supported version")
    print("   Example: '2024-02-15-preview' or '2023-12-01-preview'")
    print("\n4. API Key: Get from Azure Portal > Keys and Endpoint")
    print("   Should be 32 characters long")

def main():
    print("🔧 Azure OpenAI Configuration Diagnostic")
    print("=" * 60)
    
    # Check environment variables
    env_ok = check_environment_variables()
    
    if not env_ok:
        suggest_common_fixes()
        sys.exit(1)
    
    # Test connection
    connection_ok = test_azure_openai_connection()
    
    if not connection_ok:
        suggest_common_fixes()
        sys.exit(1)
    
    print("\n🎉 All checks passed! Your Azure OpenAI configuration looks good.")

if __name__ == "__main__":
    main()
