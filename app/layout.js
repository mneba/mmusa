import './globals.css';

export const metadata = {
  title: 'Pool Leads AI Agent',
  description: 'AI Voice Agent para ativação de leads - Twilio + OpenAI Realtime API',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import { AuthProvider } from '@/lib/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
