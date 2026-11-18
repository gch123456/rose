function luminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
    const linear = channels.map(channel => channel <= .04045
        ? channel / 12.92
        : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

export function contrastRatio(first, second) {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export function capsuleInk(color) {
    return contrastRatio(color, '#ffffff') >= contrastRatio(color, '#000000') ? '#ffffff' : '#000000';
}
