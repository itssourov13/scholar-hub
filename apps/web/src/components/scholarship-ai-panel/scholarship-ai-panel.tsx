import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./scholarship-ai-panel.module.css";

type Message = { role: "user" | "assistant"; content: string };

export default function ScholarshipAiPanel({
  scholarshipId,
  scholarshipTitle,
}: {
  scholarshipId: string;
  scholarshipTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    "Am I eligible for this?",
    "What documents do I need?",
    "What are my chances?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e?: React.FormEvent, presetQuestion?: string) => {
    if (e) e.preventDefault();
    const text = presetQuestion || inputValue.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const apiMessages: Message[] = [...messages, userMessage];
    setMessages(apiMessages);

    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          // The server pulls this scholarship's exact facts and the signed-in
          // student's profile straight from the database.
          scholarshipId,
          // We don't send sessionId, so it's ephemeral
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch response");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                assistantContent += data.token;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantContent;
                  return newMsgs;
                });
              } else if (data.error) {
                console.error("Chat error:", data.error);
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={styles.banner} onClick={() => setIsOpen(true)}>
        <div className={styles.bannerContent}>
          <span className={styles.sparkle}>✨</span>
          <div>
            <strong>Want to know more about this scholarship?</strong>
            <p>Ask our AI Mentor — get instant answers about eligibility, documents, chances, and more.</p>
          </div>
        </div>
        <button className={styles.bannerButton}>Ask AI about this →</button>
      </div>

      {isOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h3>AI Mentor</h3>
                <p>Exploring {scholarshipTitle}</p>
              </div>
              <button className={styles.closeButton} onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            <div className={styles.chatArea}>
              {messages.length === 0 ? (
                <div className={styles.welcome}>
                  <p>
                    Hi! I'm ready to help you explore the <strong>{scholarshipTitle}</strong> scholarship.
                    Here are some things students usually ask about:
                  </p>
                  <div className={styles.chipRow}>
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        className={styles.chip}
                        onClick={() => handleSubmit(undefined, q)}
                        disabled={isLoading}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.messages}>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={msg.role === "user" ? styles.userMessage : styles.assistantMessage}
                    >
                      {msg.role === "assistant" ? (
                        <div className={styles.markdownBody}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className={styles.loadingIndicator}>AI is typing...</div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form className={styles.inputArea} onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Ask a question..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className={styles.input}
              />
              <button type="submit" disabled={!inputValue.trim() || isLoading} className={styles.sendButton}>
                Send
              </button>
            </form>
            <p className={styles.panelDisclaimer}>
              ✦ AI responses are a helpful guide — verify key details from the official scholarship website.
            </p>
          </div>
        </>
      )}
    </>
  );
}
