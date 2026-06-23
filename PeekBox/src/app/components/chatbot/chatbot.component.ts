import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotEngineService } from '../../services/chatbot-engine';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
})
export class ChatbotComponent {
  showChat = false;
  chatMessages: ChatMessage[] = [];
  isTyping = false;
  suggestions: string[] = [];
  @ViewChild('chatBody', { static: false }) chatBodyRef!: ElementRef;
  private welcomeShown = false;

  constructor(
    private chatbotEngine: ChatbotEngineService,
  ) {}

  toggleChat() {
    this.showChat = !this.showChat;
    if (this.showChat) {
      if (!this.welcomeShown) {
        this.welcomeShown = true;
        this.chatMessages.push({
          text: 'Ciao! Sono il tuo assistente PeekBox 🤖\n\nPosso aiutarti a gestire box, oggetti, spazi e molto altro. Ecco cosa so fare:\n\n📦 Box — totali, preferite, in transito, cestino\n📋 Oggetti — conteggio e ricerca\n🏠 Spazi — armadi e archivi\n🤝 Condivisioni — chi condivide con te\n📊 Riepilogo — statistiche complete\n📍 Posizioni — GPS delle tue box\n✉️ Messaggi — centro messaggi e supporto\n\nDigita "aiuto" per l\'elenco completo o una domanda qualsiasi!',
          isUser: false,
        });
        this.suggestions = ['Quante box ho?', 'Ciao!', 'Aiuto', 'Messaggi?'];
      }
      setTimeout(() => this.scrollChatBottom(), 100);
    }
  }

  sendSuggestion(text: string) {
    this.suggestions = [];
    this.sendMessage(text);
  }

  async sendMessage(text: string) {
    const msg = text?.trim();
    if (!msg || this.isTyping) return;

    this.suggestions = [];
    this.chatMessages.push({ text: msg, isUser: true });
    this.isTyping = true;
    setTimeout(() => this.scrollChatBottom(), 50);

    const risposta = await this.chatbotEngine.processMessage(msg);

    this.chatMessages.push({ text: risposta, isUser: false });
    this.isTyping = false;
    this.suggestions = this.chatbotEngine.suggerisciDomande(msg, risposta);
    setTimeout(() => this.scrollChatBottom(), 50);
  }

  private scrollChatBottom() {
    try {
      this.chatBodyRef.nativeElement.scrollTop = this.chatBodyRef.nativeElement.scrollHeight;
    } catch {}
  }
}
