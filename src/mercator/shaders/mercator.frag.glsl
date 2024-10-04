precision mediump float;

uniform sampler2D u_screen;
uniform float u_opacity;

varying vec2 v_tex_pos;

uniform vec4 u_bbox;


// Function to project the position with mercator projection
float mercY(float y) {
    float s = sin(radians(y * 180.0 - 90.0));
    return (degrees(log((1.0 + s) / (1.0 - s))) / 360.0 + 1.0) / 2.0;
}


void main() {
    vec4 color = vec4(0.0);

    // Correctly map the texture coordinates and flip the Y-axis
    vec2 uv = v_tex_pos;

    // We project the bounding box to mercator
    vec4 mercator_bbox = vec4(
        u_bbox.x,
        mercY(u_bbox.y),
        u_bbox.z,
        mercY(u_bbox.w)
    );
    

    // Convert UV from geographic position to bbox relative position
    uv = (uv - mercator_bbox.xy) / (mercator_bbox.zw - mercator_bbox.xy);


    // Sample the texture
    
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.2);
        return;
    }
    color = texture2D(u_screen, vec2(uv.x, 1.0 - uv.y));

    // Apply opacity
    color *= u_opacity;

    // Guarantee opacity fade out
    gl_FragColor = vec4(floor(255.0 * color.rgb) / 255.0, color.a);
}


