import './globals.css'; import type { Metadata } from 'next';
export const metadata:Metadata={title:'GridSwitch | Prospecting',description:'Physical-facility opportunity dashboard'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
