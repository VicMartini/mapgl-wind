precision mediump float;

uniform sampler2D u_screen;
uniform float u_opacity;

varying vec2 v_tex_pos;

void main() {
    vec2 texSize = vec2(16384.0, 16384.0);
    vec2 texel = 1.0 / texSize;
    vec4 color = vec4(0.0);

    // Bilinear blur
    vec2 uv = 1.0 - v_tex_pos;
    vec2 texel_offset = vec2(0.5) * texel;
    
    vec4 tl = texture2D(u_screen, uv + vec2(-texel_offset.x, -texel_offset.y));
    vec4 tr = texture2D(u_screen, uv + vec2(texel_offset.x, -texel_offset.y));
    vec4 bl = texture2D(u_screen, uv + vec2(-texel_offset.x, texel_offset.y));
    vec4 br = texture2D(u_screen, uv + vec2(texel_offset.x, texel_offset.y));
    
    vec2 f = fract(uv * texSize);
    
    vec4 tA = mix(tl, tr, f.x);
    vec4 tB = mix(bl, br, f.x);
    
    color = mix(tA, tB, f.y);

    // Apply opacity
    color *= u_opacity;



    // Guarantee opacity fade out
    gl_FragColor = vec4(floor(255.0 * color.rgb) / 255.0, color.a);
}
