import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Codebase Knowledge Graph | AI-Queryable Architecture Visualizer',
  description: 'AI-Queryable AST and Call Graph Intelligence Engine with Neo4j and Claude LLM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen antialiased selection:bg-primary/30 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
