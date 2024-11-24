/** @jsxImportSource https://esm.sh/react */
import React, { useState, useCallback, useRef, useEffect } from "https://esm.sh/react";
import { createRoot } from "https://esm.sh/react-dom/client";
import { motion } from "https://esm.sh/framer-motion";
import { OpenAI } from "https://esm.town/v/std/openai";

// Constants for file validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' }
];

// Color Themes with Black and Orange Palette
const THEMES = {
  light: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #ff6b00 100%)',
    primary: '#ff6b00',
    secondary: '#ff8c00',
    accent: '#ff4500',
    text: '#ffffff',
    background2: 'rgba(0,0,0,0.8)',
    chatBackground: 'rgba(30,30,30,0.9)',
    border: 'rgba(255,255,255,0.2)'
  },
  dark: {
    background: 'linear-gradient(45deg, #000000, #ff6b00, #ff4500)',
    backgroundAnimation: 'linear-gradient(-45deg, #000000, #ff6b00, #ff8c00, #ff4500)',
    primary: '#ff6b00',
    secondary: '#ff8c00',
    accent: '#ff4500',
    text: '#ffffff',
    background2: 'rgba(0,0,0,0.9)',
    chatBackground: 'rgba(20,20,20,0.9)',
    border: 'rgba(255,255,255,0.2)'
  }
};

// Interfaces
interface ProcessedImageResult {
  text: string;
  description: string;
  translatedText?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

function App() {
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const currentTheme = THEMES[theme];

  // Image Processing States
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Chat States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'initial',
      content: 'Welcome! Upload an image to start analyzing.',
      sender: 'ai',
      timestamp: Date.now()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Image Upload Handler
  const handleImageUpload = useCallback((file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload JPEG, PNG, GIF, or WebP.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImage(result);
      setImagePreview(result);
      setError(null);
    };

    reader.onerror = () => {
      setError('Error reading file. Please try again.');
      setImage(null);
      setImagePreview(null);
    };

    reader.readAsDataURL(file);
  }, []);

  // Process Image
  const processImage = useCallback(async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);
    setExtractedText(null);
    setImageDescription(null);
    
    try {
      const response = await fetch('/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image, 
          language: selectedLanguage 
        })
      });

      if (!response.ok) throw new Error('Processing failed');

      const result: ProcessedImageResult = await response.json();
      setExtractedText(result.text);
      setImageDescription(result.description);

      // Only add a single message about image analysis
      setChatMessages(prev => [
        ...prev, 
        {
          id: chat-${Date.now()},
          content: Image processed. Text and description are now available.,
          sender: 'ai',
          timestamp: Date.now()
        }
      ]);
    } catch (error) {
      setError('Image processing failed');
      setChatMessages(prev => [...prev, {
        id: error-${Date.now()},
        content: 'Sorry, I couldn\'t process the image. Please try again.',
        sender: 'ai',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [image, selectedLanguage]);

  // Chat Submission
  const handleChatSubmit = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: chat-${Date.now()},
      content: chatInput,
      sender: 'user',
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatProcessing(true);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: chatMessages, 
          newMessage: chatInput,
          imageContext: {
            description: imageDescription || '',
            text: extractedText || ''
          }
        })
      });

      if (!response.ok) throw new Error('Chat processing failed');

      const result = await response.json();
      const aiMessage: ChatMessage = {
        id: chat-${Date.now()},
        content: result.message,
        sender: 'ai',
        timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: chat-${Date.now()},
        content: 'Sorry, I am having trouble processing your request. Please try again.',
        sender: 'ai',
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatProcessing(false);
    }
  }, [chatInput, chatMessages, imageDescription, extractedText]);

  return (
    <div 
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: "'Poppins', sans-serif",
        background: currentTheme.background,
        color: currentTheme.text,
        overflow: 'hidden'
      }}
    >
      {/* Main Content Container */}
      <div style={{
        display: 'flex',
        width: '100%',
        height: '100%'
      }}>
        {/* Image Upload Section */}
        <div 
          style={{
            width: '50%', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            background: currentTheme.background2
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: currentTheme.primary,
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px'
            }}
          >
            Upload Image
          </button>

          {/* Image Preview */}
          {imagePreview && (
            <img 
              src={imagePreview} 
              alt="Preview" 
              style={{
                maxWidth: '100%', 
                maxHeight: '300px', 
                marginTop: '20px'
              }} 
            />
          )}

          {/* Process Image Button */}
          <button
            onClick={processImage}
            disabled={!image}
            style={{
              background: image ? currentTheme.secondary : '#cccccc',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              marginTop: '20px'
            }}
          >
            {isProcessing ? 'Processing...' : 'Process Image'}
          </button>

          {/* Extracted Text Display */}
          {extractedText && (
            <div 
              style={{
                marginTop: '20px', 
                padding: '10px', 
                background: currentTheme.primary,
                color: 'white',
                borderRadius: '5px',
                width: '100%'
              }}
            >
              <h3>Extracted Text:</h3>
              <p>{extractedText}</p>
            </div>
          )}

          {/* Image Description Display */}
          {imageDescription && (
            <div 
              style={{
                marginTop: '20px', 
                padding: '10px', 
                background: currentTheme.accent,
                color: 'white',
                borderRadius: '5px',
                width: '100%'
              }}
            >
              <h3>Image Description:</h3>
              <p>{imageDescription}</p>
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div 
          style={{
            width: '50%', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column',
            background: currentTheme.chatBackground
          }}
        >
          {/* Chat Messages */}
          <div 
            style={{
              flex: 1, 
              overflowY: 'auto', 
              marginBottom: '20px'
            }}
          >
            {chatMessages.map((msg) => (
              <div 
                key={msg.id}
                style={{
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                  marginBottom: '10px'
                }}
              >
                <span 
                  style={{
                    background: msg.sender === 'user' 
                      ? currentTheme.primary 
                      : currentTheme.accent,
                    color: 'white',
                    padding: '10px',
                    borderRadius: '10px',
                    display: 'inline-block'
                  }}
                >
                  {msg.content}
                </span>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div style={{ display: 'flex' }}>
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
              placeholder="Type a message..."
              style={{
                flex: 1, 
                padding: '10px', 
                marginRight: '10px',
                borderRadius: '5px'
              }}
            />
            <button 
              onClick={handleChatSubmit}
              style={{
                background: currentTheme.secondary,
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px'
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Client-side rendering function
function client() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const root = createRoot(document.getElementById("root")!);
    root.render(<App />);
  }
}

// Call client function if in browser environment
if (typeof window !== 'undefined') {
  client();
}

export default async function server(request: Request): Promise<Response> {
  // Existing server implementation remains the same as in the previous version
  if (request.method === 'GET') {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Image Chat AI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
          <script src="https://esm.town/v/std/catch"></script>
          <style>
            body { margin: 0; overflow: hidden; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="${import.meta.url}"></script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Rest of the server implementation remains the same as in the previous version
  // (Full OpenAI processing logic for image and chat endpoints)
  if (request.method === 'POST') {
    const { OpenAI } = await import("https://esm.town/v/std/openai");
    const openai = new OpenAI();

    try {
      const body = await request.json();

      if (request.url.includes('/process-image')) {
        // Image Processing Endpoint (existing implementation)
        const textExtractionResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system", 
              content: "You are an expert at extracting text from images. Transcribe ALL visible text precisely."
            },
            {
              role: "user", 
              content: [
                { 
                  type: "image_url", 
                  image_url: { url: body.image } 
                },
                { 
                  type: "text", 
                  text: "Extract ALL text from this image. Be extremely precise and capture every single word or character visible."
                }
              ]
            }
          ],
          max_tokens: 300
        });

        const extractedText = textExtractionResponse.choices[0].message.content?.trim() || "No text found";

        const descriptionResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system", 
              content: `You are an expert image analyst. 
                        Generate a comprehensive description of the image 
                        BASED SOLELY on the extracted text: "${extractedText}".
                        If no text is present, describe the image's key visual elements.`
            },
            {
              role: "user", 
              content: [
                { 
                  type: "image_url", 
                  image_url: { url: body.image } 
                },
                { 
                  type: "text", 
                  text: `Extracted Text: ${extractedText}
                         Language: ${body.language || 'en'}
                         Provide a detailed description focusing on the context of the text and image.`
                }
              ]
            }
          ],
          max_tokens: 300
        });

        const description = descriptionResponse.choices[0].message.content?.trim() 
          || "Unable to generate a description based on the extracted text.";

        return new Response(JSON.stringify({
          text: extractedText,
          description: description
        }), { 
          headers: { 'Content-Type': 'application/json' } 
        });
      } else if (request.url.includes('/chat')) {
        // Chat Endpoint (existing implementation)
        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: `You are a helpful AI assistant. 
                        Context may include an image description: ${body.imageContext?.description}
                        Image text: ${body.imageContext?.text}
                        Respond helpfully considering this context.`
            },
            ...body.messages.map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.content
            })),
            { 
              role: "user", 
              content: body.newMessage 
            }
          ],
          max_tokens: 300
        });

        return new Response(JSON.stringify({
          message: chatResponse.choices[0].message.content || "I'm not sure how to respond."
        }), { 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Fallback response for unhandled POST routes
      return new Response(JSON.stringify({ error: 'Unhandled route' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // Global error handling
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Fallback for unsupported request methods
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}
