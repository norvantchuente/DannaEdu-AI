/**
- Official decoder for segmentation tokens (<0f>0<|box;...|><|mask;...|>)
- Uncompresses COCO/SAM RLE format (LEB128 6-bit ASCII starting from '0' = 48)
 */

function decodeCocoCompressedRle(rleString, height, width) {
    const counts = [];
    let p = 0;
    const len = rleString.length;

    // If the string starts with '~', it's the segmentation RLE encoding prefix
    if (rleString.startsWith('~')) {
        p = 1;
    }

    while (p < len) {
        let x = 0;
        let k = 0;
        let more = 1;

        while (more && p < len) {
            const c = rleString.charCodeAt(p) - 48; // '0' is ASCII code 48
            x |= (c & 0x1f) << (5 * k);
            more = c & 0x20;
            p++;
            k++;
            if (!more && (c & 0x10)) {
                x |= (-1 << (5 * k));
            }
        }

        // 2nd-order differential decoding (COCO RLE specification)
        if (counts.length > 2) {
            x += counts[counts.length - 2];
        }
        counts.push(x);
    }

    return {
        size: [height, width],
        counts
    };
}

/**
- Parses raw RLE string from <|mask;...|>
- Expected format: "H,W,~..." or "rle1,rle2,rle3..." (uncompressed one_bit)
 */
function parseMaskDataField(dataStr, fallbackW = 0, fallbackH = 0) {
    if (!dataStr || typeof dataStr !== 'string') return null;

    const parts = dataStr.split(',');
    if (parts.length < 3) return null;

    const h = parseInt(parts[0], 10) || fallbackH;
    const w = parseInt(parts[1], 10) || fallbackW;
    const rest = parts.slice(2).join(',');

    if (!h || !w) return null;

    // Case 1: Compressed ASCII RLE (starts with '~' or contains non-numeric characters)
    if (rest.startsWith('~') || /[^0-9,]/.test(rest)) {
        return decodeCocoCompressedRle(rest, h, w);
    }

    // Case 2: Direct comma-separated numeric RLE (metadata.mask_encoding = "one_bit")
    const numericCounts = parts.slice(2).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    return {
        size: [h, w],
        counts: numericCounts
    };
}

/**
- Parses entire segmentation response output by frame (<0f>, <1f>...)
 */
function parseSamResponseOutput(rawOutput) {
    const frames = {};
    let wireText = '';

    if (typeof rawOutput === 'string') {
        wireText = rawOutput;
    } else if (Array.isArray(rawOutput)) {
        rawOutput.forEach(item => {
            if (item?.content && Array.isArray(item.content)) {
                item.content.forEach(c => {
                    if (typeof c.text === 'string') wireText += c.text;
                });
            } else if (typeof item?.text === 'string') {
                wireText += item.text;
            }
        });
    } else if (rawOutput && typeof rawOutput === 'object') {
        wireText = JSON.stringify(rawOutput);
    }

    if (!wireText) return frames;

    const frameRegex = /<(\d+)f>/g;
    const frameMatches = [...wireText.matchAll(frameRegex)];

    const parseChunk = (chunk) => {
        const detections = [];
        const recordRegex = /(\d+)?<\|(?:box|bbox)[:;]([^|]+)\|>(?:<\|mask[:;]([^|]+)\|>)?/gi;
        let match;

        while ((match = recordRegex.exec(chunk)) !== null) {
            const objId = match[1] !== undefined ? parseInt(match[1], 10) : detections.length;
            const boxStr = match[2];
            const maskStr = match[3] || '';

            const bKv = {};
            boxStr.split(/[;,]/).forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v !== undefined) bKv[k.trim().toLowerCase()] = parseFloat(v);
            });

            const mKv = {};
            if (maskStr) {
                maskStr.split(';').forEach(pair => {
                    const eqIdx = pair.indexOf('=');
                    if (eqIdx !== -1) {
                        mKv[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
                    }
                });
            }

            const decodedRle = mKv.data
                ? parseMaskDataField(mKv.data, bKv.w || 0, bKv.h || 0)
                : null;

            detections.push({
                objId,
                box: {
                    mode: 'xyxy',
                    x1: bKv.x1 ?? bKv.x ?? 0,
                    y1: bKv.y1 ?? bKv.y ?? 0,
                    x2: bKv.x2 ?? ((bKv.x || 0) + (bKv.w || 0)),
                    y2: bKv.y2 ?? ((bKv.y || 0) + (bKv.h || 0)),
                    refW: bKv.w || null,
                    refH: bKv.h || null
                },
                maskOffset: {
                    x: parseFloat(mKv.x || 0),
                    y: parseFloat(mKv.y || 0),
                    w: parseFloat(mKv.w || 0),
                    h: parseFloat(mKv.h || 0)
                },
                rle: decodedRle // Contains { size: [H, W], counts: [...] }
            });
        }
        return detections;
    };

    if (frameMatches.length > 0) {
        for (let i = 0; i < frameMatches.length; i++) {
            const fIdx = parseInt(frameMatches[i][1], 10);
            const start = frameMatches[i].index + frameMatches[i][0].length;
            const end = (i + 1 < frameMatches.length) ? frameMatches[i + 1].index : wireText.length;
            const dets = parseChunk(wireText.slice(start, end));
            if (dets.length > 0) frames[fIdx] = dets;
        }
    } else {
        const dets = parseChunk(wireText);
        if (dets.length > 0) frames[0] = dets;
    }

    return frames;
}

module.exports = {
    parseSamResponseOutput,
    decodeCocoCompressedRle,
    parseMaskDataField
};