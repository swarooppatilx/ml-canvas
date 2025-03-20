const api = "AIzaSyCS6Sbuay-uzHNsC1aFrXN7EbG7sOnZWBY";
const chatbot = document.getElementById("chatbot");
const chatToggle = document.getElementById("chatToggle");
const chatBody = document.getElementById("chatBody");
const userInput = document.getElementById("userInput");
let isTyping = false; // To track if the bot is "typing"

function appendMessage(sender, message, isBot = false) {
  const messageDiv = document.createElement("div");
  messageDiv.textContent = `${sender}: ${message}`;
  messageDiv.classList.add("p-2", "rounded-md", "mt-1", "break-words"); // Added break-words for long messages

  if (sender === "You") {
    messageDiv.classList.add("user-message");
  } else {
    messageDiv.classList.add("bot-message");
  }

  chatBody.appendChild(messageDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  appendMessage("You", message);
  userInput.value = "";

  // Show typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("typing-indicator");
  typingDiv.textContent = "Bot is typing...";
  chatBody.appendChild(typingDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
  isTyping = true;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        api,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: message }] }],
        }),
      }
    );

    // Remove typing indicator
    if (isTyping) {
      chatBody.removeChild(typingDiv);
      isTyping = false;
    }

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage =
        errorData.error?.message ||
        `Error fetching response: ${response.status}`;
      appendMessage("Bot", errorMessage);
    } else {
      const data = await response.json();
      const botMessage =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I couldn't understand that.";
      appendMessage("Bot", botMessage);
    }
  } catch (error) {
    console.error("Error:", error);
    // Remove typing indicator in case of an error
    if (isTyping) {
      chatBody.removeChild(typingDiv);
      isTyping = false;
    }
    appendMessage("Bot", "Error communicating with the chatbot.");
  }
}

function toggleChatbot() {
  chatbot.classList.toggle("hidden");
  chatToggle.classList.toggle("hidden");
}

function minimizeChatbot() {
  chatbot.classList.add("hidden");
  chatToggle.classList.remove("hidden");
}
