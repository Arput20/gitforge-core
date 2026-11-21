import http from 'node:http';
import { store, sendJson, sendError } from '../app.ts';

export async function handleGit(req: http.IncomingMessage, res: http.ServerResponse, owner: string, repoName: string, service: string) {
    const name = repoName.endsWith('.git') ? repoName.slice(0, -4) : repoName;
    console.log(`Git request: owner=${owner}, repo=${name}, service=${service}`);
    const repo = store.repos.get(`${owner}/${name}`);
    if (!repo) {
        console.log(`Repo not found: ${owner}/${name}`);
        sendError(res, 404, 'Repository not found');
        return;
    }
    
    if (service === 'info/refs') {
        const serviceName = new URL(req.url!, 'http://localhost').searchParams.get('service');
        if (!serviceName) {
            sendError(res, 400, 'Missing service');
            return;
        }
        
        const refs = Array.from(repo.refs.entries());
        let advertisement = `# service=${serviceName}\n`;
        // pkt-line: len = payload.length + 4
        
        const resLines: Buffer[] = [];
        
        // 1. service advertisement
        const svc = Buffer.from(`# service=${serviceName}\n`);
        const svcHeader = Buffer.alloc(4);
        svcHeader.write((svc.length + 4).toString(16).padStart(4, '0'), 0, 4, 'ascii');
        resLines.push(Buffer.concat([svcHeader, svc]));
        
        // 2. flush
        resLines.push(Buffer.from('0000', 'ascii'));
        
        // 3. refs
        for (const [ref, oid] of refs) {
            const line = `${oid} ${ref}\0\n`;
            const lineBuf = Buffer.from(line);
            const header = Buffer.alloc(4);
            header.write((lineBuf.length + 4).toString(16).padStart(4, '0'), 0, 4, 'ascii');
            resLines.push(Buffer.concat([header, lineBuf]));
        }
        resLines.push(Buffer.from('0000', 'ascii'));
        
        res.writeHead(200, {
            'Content-Type': `application/x-${serviceName}-advertisement`,
            'Cache-Control': 'no-cache',
        });
        
        for (const line of resLines) {
            res.write(line);
        }
        res.end();
        return;
    }
    
    // Upload/Receive pack not yet implemented
    sendError(res, 501, 'Not Implemented');
}
