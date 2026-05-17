/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bot, Shield, Zap, Image as ImageIcon } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-4 mb-12 border-b border-gray-800 pb-8">
          <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Bot size={40} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Daki Bot Dashboard</h1>
            <p className="text-gray-400 mt-2 text-lg">Panel de control de tu bot de Discord profesional.</p>
          </div>
        </header>

        <main className="grid md:grid-cols-2 gap-8">
          <section className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Shield className="text-emerald-400" />
              Estado del Sistema
            </h2>
            
            <div className="space-y-6">
              <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-4 flex items-start gap-4">
                 <div className="mt-1 h-3 w-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                 <div>
                    <h3 className="font-medium text-emerald-300">Bot en línea</h3>
                    <p className="text-sm text-gray-400 mt-1">El servidor web está funcionando. Para que el bot conecte a Discord, asegúrate de configurar las variables de entorno.</p>
                 </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h3 className="font-medium text-gray-200 mb-3">Variables Necesarias (en .env)</h3>
                <ul className="space-y-3 font-mono text-sm">
                  <li className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400">DISCORD_TOKEN</span>
                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">Requerido</span>
                  </li>
                  <li className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400">CLIENT_ID</span>
                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">Requerido (Comandos)</span>
                  </li>
                  <li className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400">GUILD_ID</span>
                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">Opcional (Pruebas)</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-400">WELCOME_CHANNEL_ID</span>
                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">Para fotos de bienvenida</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-8">
             <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-8 backdrop-blur-sm">
               <h2 className="text-xl font-semibold mb-4 text-gray-200">Características Activas</h2>
               <div className="grid gap-4">
                 <div className="flex gap-4 p-4 rounded-xl bg-gray-800/80 border border-gray-700 hover:border-indigo-500/50 transition-colors">
                   <div className="text-indigo-400"><Zap /></div>
                   <div>
                     <h3 className="font-medium text-gray-200">Anti-Spam & Anti-Links</h3>
                     <p className="text-sm text-gray-400 mt-1">Protección automática activada en todos los canales. Mutea usuarios por exceso de mensajes.</p>
                   </div>
                 </div>
                 
                 <div className="flex gap-4 p-4 rounded-xl bg-gray-800/80 border border-gray-700 hover:border-indigo-500/50 transition-colors">
                   <div className="text-indigo-400"><ImageIcon /></div>
                   <div>
                     <h3 className="font-medium text-gray-200">Fotos de Bienvenida</h3>
                     <p className="text-sm text-gray-400 mt-1">Generadas dinámicamente con CanvasJS cada vez que un usuario se une al servidor.</p>
                   </div>
                 </div>

                 <div className="flex gap-4 p-4 rounded-xl bg-gray-800/80 border border-gray-700 hover:border-indigo-500/50 transition-colors">
                   <div className="text-indigo-400"><Bot /></div>
                   <div>
                     <h3 className="font-medium text-gray-200">Comandos Slash (/aviso)</h3>
                     <p className="text-sm text-gray-400 mt-1">Arquitectura extensible con soporte completo para interacciones y comandos de aplicación.</p>
                   </div>
                 </div>
               </div>
             </div>
          </section>
        </main>
      </div>
    </div>
  );
}
