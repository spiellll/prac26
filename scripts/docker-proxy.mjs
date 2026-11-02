import http from 'node:http';
const localHosts=new Set(['localhost','127.0.0.1','[::1]']);
function localRequest(request){try{const url=new URL('http://'+request.headers.host);return localHosts.has(url.hostname)&&!url.username&&!url.password&&url.pathname==='/'}catch{return false}}
// Keep Vite's local-only authentication on loopback inside the container.
// Docker publishes only this proxy, and only on the host's loopback address.
export function createLocalProxy(targetPort=5173,targetHost='127.0.0.1'){
 const server=http.createServer((request,response)=>{
  if(!localRequest(request)){response.writeHead(403);response.end();return}
  const upstream=http.request({hostname:targetHost,port:targetPort,path:request.url,method:request.method,headers:request.headers,agent:false},res=>{response.writeHead(res.statusCode??502,res.headers);res.pipe(response)});
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});response.end('Ритм запускается. Обнови страницу через несколько секунд.')});
  request.on('aborted',()=>upstream.destroy());request.pipe(upstream);
 });
 const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket))});
 server.closeLocalConnections=()=>{for(const socket of sockets)socket.destroy()};
 server.on('upgrade',(request,socket,head)=>{
  if(!localRequest(request)){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return}
  const upstream=http.request({hostname:targetHost,port:targetPort,path:request.url,method:request.method,headers:request.headers,agent:false});
  upstream.on('upgrade',(response,remote,remoteHead)=>{
   socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`+response.rawHeaders.reduce((s,v,i)=>s+(i%2?': '+v+'\r\n':v),'')+'\r\n');
   if(remoteHead.length)socket.write(remoteHead);if(head.length)remote.write(head);
   remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy());
   socket.on('close',()=>remote.destroy());remote.on('close',()=>socket.destroy());
   socket.pipe(remote).pipe(socket);
  });
  upstream.on('response',res=>{socket.end(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\nConnection: close\r\n\r\n`);res.resume()});
  upstream.on('error',()=>socket.destroy());upstream.end();
 });
 return server;
}
