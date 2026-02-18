import './globals.css';

export const metadata = {
  title: "Support Staff Management Dashboard",
  description: "Internal Staff Management System",
  icons: {
    icon: 'https://rage.mp/uploads/monthly_2020_05/ecrplogo.png.09fc2356f8a6037b033ebab7f74142ae.png',
  },
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
