precision mediump float;

uniform sampler2D u_screen;
uniform float u_opacity;

varying vec2 v_tex_pos;

void main() {

    vec4 color = vec4(0.0);

    vec2 uv = 1.0 - v_tex_pos;
    color = texture2D(u_screen, uv);

    // Apply opacity
    color *= u_opacity;

    // Guarantee opacity fade out
    gl_FragColor = vec4(floor(255.0 * color.rgb) / 255.0, color.a);
}
