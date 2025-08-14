import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
