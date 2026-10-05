import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Vitrine — Boas escolhas, novas possibilidades',description:'Compre, venda e acompanhe entregas em uma vitrine segura. Projeto acadêmico demonstrativo.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
