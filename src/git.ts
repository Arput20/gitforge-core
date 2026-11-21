import { createHash } from 'node:crypto';

export function hash(data: Buffer): string {
    return createHash('sha1').update(data).digest('hex');
}

export function createBlob(content: Buffer): { sha: string, bytes: Buffer } {
    const header = Buffer.from(`blob ${content.length}\0`);
    const bytes = Buffer.concat([header, content]);
    return { sha: hash(bytes), bytes };
}

export function createTree(entries: { mode: string, name: string, sha: string }[]): { sha: string, bytes: Buffer } {
    // Entries must be sorted by name
    const sortedEntries = entries.sort((a, b) => a.name.localeCompare(b.name));
    let content = Buffer.alloc(0);
    for (const entry of sortedEntries) {
        // "<mode> <name>\0<sha-bin>"
        // Sha is hex string, need to convert to binary.
        const shaBin = Buffer.from(entry.sha, 'hex');
        const entryBuf = Buffer.concat([
            Buffer.from(`${entry.mode} ${entry.name}\0`),
            shaBin
        ]);
        content = Buffer.concat([content, entryBuf]);
    }
    const header = Buffer.from(`tree ${content.length}\0`);
    const bytes = Buffer.concat([header, content]);
    return { sha: hash(bytes), bytes };
}

export function createCommit(treeSha: string, parentSha: string | null, message: string, author: { name: string, email: string, date: string }): { sha: string, bytes: Buffer } {
    let content = `tree ${treeSha}\n`;
    if (parentSha) {
        content += `parent ${parentSha}\n`;
    }
    content += `author ${author.name} <${author.email}> ${author.date}\n`;
    content += `committer ${author.name} <${author.email}> ${author.date}\n`;
    content += `\n${message}\n`;
    
    const bytes = Buffer.from(content);
    const header = Buffer.from(`commit ${bytes.length}\0`);
    const fullBytes = Buffer.concat([header, bytes]);
    return { sha: hash(fullBytes), bytes: fullBytes };
}
