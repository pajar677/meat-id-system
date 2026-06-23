import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Meat Identification System - AI Scanner',
  description: 'Sistem berbasis kecerdasan buatan (AI) untuk mendeteksi jenis daging (Sapi, Ayam, Kambing, Babi, Ikan) dilengkapi dengan informasi kandungan gizi dan riwayat pencarian.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
