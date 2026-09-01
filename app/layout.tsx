import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://devops-commits.github.io/nova-yoga-rituel-film/'),
  title: 'Nova Yoga — Proposition B « Rituel »',
  description:
    'Et si le chemin commençait simplement ici ? Sept Portes, dix Regards — Nova Yoga, Jade Tamura.',
  openGraph: {
    title: 'Nova Yoga — Proposition B « Rituel »',
    description:
      'Et si le chemin commençait simplement ici ? Sept Portes, dix Regards — Nova Yoga, Jade Tamura.',
    url: '/',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nova Yoga — Proposition B « Rituel »',
    description:
      'Et si le chemin commençait simplement ici ? Sept Portes, dix Regards — Nova Yoga, Jade Tamura.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
