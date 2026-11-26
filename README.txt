REELORA VISION CHAT UPGRADE

Replace these files in your repository:
1. public/app.js
2. public/index.html
3. public/vision-chat.css (new file)
4. api/vision.js

What changed:
- Smoother chat scrolling and responsive chat layout.
- Copy full message button on each message.
- Edit a user message and regenerate the conversation from that point.
- Speaker icon on VISION replies instead of a text Listen button.
- Live Talk: browser speech recognition for your voice and spoken VISION replies.
- Existing Groq speech is attempted first; browser speech synthesis is a fallback if Groq TTS is unavailable or terms have not yet been accepted.
- VISION's initiative/personality prompt is expanded without claiming literal consciousness.
- Tavily web research triggers for a broader range of current-information and verification questions.

Important:
- Live Talk uses browser speech recognition and therefore requires microphone permission and a browser that supports SpeechRecognition (commonly Chrome-based browsers). It is turn-based hands-free conversation, not a full-duplex realtime audio model.
- Web search uses the existing TAVILY_API_KEY. No new API key is required if it is already configured.
- Groq's Orpheus voice still requires the organisation terms acceptance shown in your earlier screenshot. Browser speech fallback is functional but will not sound like the custom James Spader-inspired voice target.
- Do not replace unrelated files or delete existing environment variables.

Suggested commit message:
Upgrade VISION chat experience
