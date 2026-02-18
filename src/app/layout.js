import './globals.css';

export const metadata = {
  title: "Support Staff Management Dashboard",
  description: "Internal Staff Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-300 min-h-screen">
        {children}
      </body>
    </html>
  );
}
