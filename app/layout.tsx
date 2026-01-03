import "./globals.css";

export const metadata = {
  title: "Wine Bar Daily Ops",
  description: "Daily Sales → Daily Loss input"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
