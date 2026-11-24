/** @type {import('next').NextConfig} */
const nextConfig={
 reactStrictMode:true,poweredByHeader:false,
 async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'SAMEORIGIN'}]}]},
 ...(process.env.KILLA_DESKTOP_STANDALONE==='1'?{output:'standalone'}:{}),
 async redirects(){
  return [
   {source:'/report',destination:'/relatorios',permanent:false},
   {source:'/finalizados',destination:'/clientes',permanent:false},
   {source:'/revisar',destination:'/clientes',permanent:false},
   {source:'/minhas-atividades',destination:'/agentes',permanent:false},
   {source:'/veredito',destination:'/processos',permanent:false}
  ];
 }
};
export default nextConfig;
