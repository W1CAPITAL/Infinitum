import {redirect} from 'next/navigation';
export default async function Page({searchParams}){const p=await searchParams;const buscar=typeof p?.buscar==='string'?p.buscar:'';if(buscar)redirect('/processos?buscar='+encodeURIComponent(buscar));redirect('/processos')}
