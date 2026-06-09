<?php
/**
 * Plugin Name: Tích hợp NKS Bất Động Sản
 * Description: Đồng bộ dữ liệu BĐS từ API NKS, hỗ trợ quản lý tin đăng (Thêm, Xóa, Sửa CPT), so sánh chuyên sâu và cấp API cho Vercel.
 * Version: 5.0
 * Author: NKS
 */

if (!defined('ABSPATH')) exit;

define('NKS_COLOR', '#0077bb');
define('NKS_VER',   '2.5');
define('NKS_URL',   plugin_dir_url(__FILE__));
define('NKS_DIR',   plugin_dir_path(__FILE__));

/* ================================================================
   1. KÍCH HOẠT & RESET ĐƯỜNG DẪN TĨNH
   ================================================================ */
register_activation_hook(__FILE__, 'nks_activate');
function nks_activate() {
    add_option('nks_api_url', 'https://online.nks.vn/api/nks/rsitems');
    add_option('nks_api_key', '');
    nks_register_post_type();
    flush_rewrite_rules();
}

/* ================================================================
   2. KHỞI TẠO CUSTOM POST TYPE (QUẢN LÝ TIN ĐĂNG)
   ================================================================ */
add_action('init', 'nks_register_post_type');
function nks_register_post_type() {
    $labels = [
        'name'               => 'NKS BĐS',
        'singular_name'      => 'Bất Động Sản',
        'menu_name'          => 'NKS BĐS',
        'all_items'          => 'Tất cả tin đăng',
        'add_new'            => 'Thêm tin mới',
        'add_new_item'       => 'Thêm tin Bất Động Sản mới',
        'edit_item'          => 'Sửa tin đăng',
        'new_item'           => 'Tin đăng mới',
        'view_item'          => 'Xem tin đăng',
        'search_items'       => 'Tìm kiếm tin đăng',
        'not_found'          => 'Không tìm thấy tin nào',
        'not_found_in_trash' => 'Không có tin nào trong thùng rác',
    ];

    $args = [
        'labels'             => $labels,
        'public'             => true,
        'has_archive'        => true,
        'menu_icon'          => 'dashicons-admin-home',
        'supports'           => ['title', 'editor', 'thumbnail'],
        'rewrite'            => ['slug' => 'bds'],
        'show_in_rest'       => true, 
    ];

    register_post_type('nks_property', $args);
}

/* ================================================================
   3. CẤU HÌNH CÁC CỘT HIỂN THỊ TRONG TRANG DANH SÁCH ADMIN
   ================================================================ */
add_filter('manage_nks_property_posts_columns', 'nks_set_custom_cpt_columns');
function nks_set_custom_cpt_columns($columns) {
    $new_columns = [];
    $new_columns['cb'] = $columns['cb'];
    $new_columns['title'] = $columns['title'];
    $new_columns['nks_api_id'] = 'NKS API ID';
    $new_columns['nks_price'] = 'Giá hiển thị';
    $new_columns['nks_area'] = 'Diện tích';
    $new_columns['nks_type'] = 'Phân loại';
    $new_columns['date'] = $columns['date'];
    return $new_columns;
}

add_action('manage_nks_property_posts_custom_column', 'nks_custom_cpt_column_content', 10, 2);
function nks_custom_cpt_column_content($column, $post_id) {
    switch ($column) {
        case 'nks_api_id':
            $api_id = get_post_meta($post_id, '_nks_api_id', true);
            echo $api_id ? '<code>#' . esc_html($api_id) . '</code>' : '<span style="color:#94a3b8">Tự đăng tay</span>';
            break;
        case 'nks_price':
            echo esc_html(get_post_meta($post_id, '_nks_formatted_price', true) ?: '—');
            break;
        case 'nks_area':
            $area = get_post_meta($post_id, '_nks_total_area', true);
            echo $area ? esc_html($area) . ' m²' : '—';
            break;
        case 'nks_type':
            echo esc_html(get_post_meta($post_id, '_nks_rstype', true) ?: '—');
            break;
    }
}

/* ================================================================
   4. TẠO FORM NHẬP THÔNG TIN CHI TIẾT BĐS (META BOXES)
   ================================================================ */
add_action('add_meta_boxes', 'nks_add_property_meta_boxes');
function nks_add_property_meta_boxes() {
    add_meta_box('nks_property_details', 'Thông tin bổ sung Bất Động Sản', 'nks_property_meta_box_html', 'nks_property', 'normal', 'high');
}

function nks_property_meta_box_html($post) {
    $api_id    = get_post_meta($post->ID, '_nks_api_id', true);
    $price     = get_post_meta($post->ID, '_nks_price', true);
    $price_f   = get_post_meta($post->ID, '_nks_formatted_price', true);
    $area      = get_post_meta($post->ID, '_nks_total_area', true);
    $rstype    = get_post_meta($post->ID, '_nks_rstype', true);
    $bed       = get_post_meta($post->ID, '_nks_bed', true);
    $bath      = get_post_meta($post->ID, '_nks_bath', true);
    $direction = get_post_meta($post->ID, '_nks_direction', true);
    $address   = get_post_meta($post->ID, '_nks_address', true);
    $phone     = get_post_meta($post->ID, '_nks_phone', true);
    
    wp_nonce_field('nks_save_property_meta', 'nks_property_meta_nonce');
    ?>
    <style>
        .nks-meta-table { width: 100%; border-collapse: collapse; }
        .nks-meta-table td { padding: 10px; vertical-align: middle; }
        .nks-meta-table label { font-weight: 600; color: #334155; }
        .nks-meta-table input { width: 100%; max-width: 450px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; }
    </style>
    <table class="nks-meta-table">
        <tr>
            <td style="width: 180px;"><label>NKS API ID gốc:</label></td>
            <td><input type="text" name="nks_api_id" value="<?php echo esc_attr($api_id); ?>" <?php echo $api_id ? 'readonly style="background:#f1f5f9;color:#64748b;"' : ''; ?> placeholder="Hệ thống tự nhận diện khi đồng bộ hoặc trống nếu đăng tay"></td>
        </tr>
        <tr>
            <td><label>Giá trị số (VND):</label></td>
            <td><input type="number" name="nks_price" value="<?php echo esc_attr($price); ?>" placeholder="Ví dụ: 5000000000"></td>
        </tr>
        <tr>
            <td><label>Giá chữ hiển thị:</label></td>
            <td><input type="text" name="nks_formatted_price" value="<?php echo esc_attr($price_f); ?>" placeholder="Ví dụ: Giá chỉ 5 Tỷ, Thỏa thuận..."></td>
        </tr>
        <tr>
            <td><label>Diện tích tổng (m²):</label></td>
            <td><input type="number" step="0.1" name="nks_total_area" value="<?php echo esc_attr($area); ?>" placeholder="Ví dụ: 85.5"></td>
        </tr>
        <tr>
            <td><label>Loại hình BĐS:</label></td>
            <td><input type="text" name="nks_rstype" value="<?php echo esc_attr($rstype); ?>" placeholder="Ví dụ: Căn hộ, Nhà cấp 4, Đất nền..."></td>
        </tr>
        <tr>
            <td><label>Số phòng ngủ:</label></td>
            <td><input type="number" name="nks_bed" value="<?php echo esc_attr($bed); ?>"></td>
        </tr>
        <tr>
            <td><label>Số phòng tắm:</label></td>
            <td><input type="number" name="nks_bath" value="<?php echo esc_attr($bath); ?>"></td>
        </tr>
        <tr>
            <td><label>Hướng nhà/đất:</label></td>
            <td><input type="text" name="nks_direction" value="<?php echo esc_attr($direction); ?>" placeholder="Ví dụ: Đông Nam"></td>
        </tr>
        <tr>
            <td><label>Địa chỉ chi tiết:</label></td>
            <td><input type="text" name="nks_address" value="<?php echo esc_attr($address); ?>" style="max-width: 600px;"></td>
        </tr>
        <tr>
            <td><label>Số điện thoại liên hệ:</label></td>
            <td><input type="text" name="nks_phone" value="<?php echo esc_attr($phone); ?>"></td>
        </tr>
    </table>
    <?php
}

add_action('save_post_nks_property', 'nks_save_property_meta_data');
function nks_save_property_meta_data($post_id) {
    if (!isset($_POST['nks_property_meta_nonce']) || !wp_verify_nonce($_POST['nks_property_meta_nonce'], 'nks_save_property_meta')) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!current_user_can('edit_post', $post_id)) return;

    $fields = ['nks_api_id', 'nks_price', 'nks_formatted_price', 'nks_total_area', 'nks_rstype', 'nks_bed', 'nks_bath', 'nks_direction', 'nks_address', 'nks_phone'];
    foreach ($fields as $field) {
        if (isset($_POST[$field])) {
            update_post_meta($post_id, '_' . $field, sanitize_text_field($_POST[$field]));
        }
    }
}

/* ================================================================
   5. ĐIỀU CHỈNH SUBMENU TRONG MENU CPT CHÍNH
   ================================================================ */
add_action('admin_menu', 'nks_admin_menu_tweaks');
function nks_admin_menu_tweaks() {
    add_submenu_page('edit.php?post_type=nks_property', 'Đồng bộ dữ liệu NKS', 'Đồng bộ dữ liệu API', 'manage_options', 'nks-sync', 'nks_page_sync');
    add_submenu_page('edit.php?post_type=nks_property', 'Cấu hình kết nối API', 'Cấu hình API Key', 'manage_options', 'nks-settings', 'nks_page_settings');
}

add_action('admin_head', 'nks_admin_css');
function nks_admin_css() {
    $s = get_current_screen();
    if (!$s || strpos($s->id, 'nks_property') === false) return;
    echo '<style>
    :root{--nks:'.NKS_COLOR.'}
    .nks-wrap{max-width:1100px; padding-top: 10px;}
    .nks-wrap h1{color:var(--nks);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .nks-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin-bottom:20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);}
    .nks-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:none;text-decoration:none;transition:all .2s;font-family:inherit}
    .nks-btn-success{background:#16a34a;color:#fff}.nks-btn-success:hover{background:#15803d;color:#fff}
    .nks-log{background:#0f172a;color:#94a3b8;font-family:monospace;font-size:12px;padding:16px;border-radius:8px;max-height:280px;overflow-y:auto;margin-top:16px;display:none}
    .nks-log.on{display:block}.nks-log .ok{color:#4ade80}.nks-log .er{color:#f87171}.nks-log .in{color:#60a5fa}
    .nks-bar{height:6px;background:#e2e8f0;border-radius:999px;margin:12px 0;overflow:hidden;display:none}
    .nks-bar.on{display:block}.nks-bar-fill{height:100%;background:var(--nks);border-radius:999px;width:0;transition:width .3s}
    .nks-tbl{width:100%;border-collapse:collapse;font-size:13px; margin-top:15px;}
    .nks-tbl th{background:#f8fafc;padding:10px 14px;text-align:left;border-bottom:2px solid #e2e8f0;color:#475569;font-weight:600;}
    .nks-tbl td{padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .nks-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#dbeafe;color:#1d4ed8}
    </style>';
}

/* ================================================================
   6. GIAO DIỆN ADMIN TRANG ĐỒNG BỘ DỮ LIỆU CPT
   ================================================================ */
function nks_page_sync() {
    $count_posts = wp_count_posts('nks_property');
    $all = $count_posts->publish + $count_posts->draft;
    ?>
    <div class="wrap nks-wrap">
        <h1>⟳ Đồng bộ dữ liệu sạch về WordPress CPT</h1>
        <div class="nks-card">
            <p style="color:#475569;margin-bottom:20px; font-size:14px; line-height:1.6;">
                Hệ thống nạp gói tin thông minh. Các mã tin từ API nếu trùng lặp <strong>NKS API ID</strong> sẽ được cập nhật nội dung mới nhất, tránh tình trạng nhân bản tràn lan dữ liệu.
            </p>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                <button id="nks-sync-btn" class="nks-btn nks-btn-success" onclick="nksSync()">⟳ Bắt đầu quét & đồng bộ</button>
                <span style="color:#64748b;font-size:13px">Số lượng tin thực tế trên Website: <strong><?php echo number_format($all); ?></strong> tin</span>
            </div>
            <div class="nks-bar" id="nks-bar"><div class="nks-bar-fill" id="nks-fill"></div></div>
            <div class="nks-log" id="nks-log"></div>
        </div>
    </div>
    <script>
    function nksLog(m,t='in'){const l=document.getElementById('nks-log');l.classList.add('on');l.innerHTML+='<div class="'+t+'">'+m+'</div>';l.scrollTop=l.scrollHeight;}
    function nksPct(p){document.getElementById('nks-bar').classList.add('on');document.getElementById('nks-fill').style.width=p+'%';}
    async function nksSync(){
        const btn=document.getElementById('nks-sync-btn');
        btn.disabled=true;btn.textContent='⏳ Hệ thống đang xử lý phân tích...';
        document.getElementById('nks-log').innerHTML='';
        nksLog('🚀 Đang gửi yêu cầu kết nối đến máy chủ API NKS...','in');nksPct(25);
        try{
            const r=await fetch(ajaxurl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
                body:'action=nks_do_sync&nonce=<?php echo wp_create_nonce('nks_sync'); ?>'});
            const d=await r.json();nksPct(100);
            if(d.success){
                nksLog('✅ Tiến trình kết thúc! Đồng bộ thành công: <strong>'+d.data.count+'</strong> gói tin BĐS sạch.','ok');
                nksLog('⏱ Thời gian thực thi hệ thống: '+d.data.time+' giây.','in');
                nksLog('🔄 <a href="edit.php?post_type=nks_property" style="color:#4ade80; font-weight:bold;">→ Đi đến bảng Thêm, Xóa, Sửa tin đăng</a>','ok');
            }else{
                nksLog('❌ Lỗi xử lý: '+(d.data||'Mất kết nối cấu trúc mạng.'),'er');
            }
        }catch(e){nksLog('❌ Lỗi mạng: '+e.message,'er');}
        btn.disabled=false;btn.textContent='⟳ Thực hiện đồng bộ lại';
    }
    </script>
    <?php
}

/* ================================================================
   7. GIAO DIỆN CẤU HÌNH API KEY
   ================================================================ */
add_action('admin_init', 'nks_reg_settings');
function nks_reg_settings() {
    register_setting('nks_opts', 'nks_api_url');
    register_setting('nks_opts', 'nks_api_key');
}

function nks_page_settings() {
    $msg        = '';
    $preview    = [];
    $total_api  = 0;

    if (isset($_POST['nks_test']) && check_admin_referer('nks_do_test')) {
        $url  = get_option('nks_api_url', 'https://online.nks.vn/api/nks/rsitems');
        $key  = get_option('nks_api_key', '');
        $hdrs = ['Content-Type' => 'application/json'];
        if ($key) $hdrs['Authorization'] = 'Bearer ' . $key;

        // Tải cấu hình timeout cao, bỏ qua SSL
        $res = wp_remote_post($url, [
            'timeout'   => 120, 
            'headers'   => $hdrs, 
            'body'      => json_encode([]),
            'sslverify' => false
        ]);

        if (is_wp_error($res)) {
            $msg = '<div class="notice notice-error"><p>❌ Lỗi kết nối API: <strong>'.esc_html($res->get_error_message()).'</strong></p></div>';
        } else {
            $code  = wp_remote_retrieve_response_code($res);
            $body  = json_decode(wp_remote_retrieve_body($res), true);

            $items = [];
            if (is_array($body) && isset($body[0]))                     $items = $body;
            elseif (!empty($body['data']) && is_array($body['data']))   $items = $body['data'];
            elseif (!empty($body['items']) && is_array($body['items'])) $items = $body['items'];
            elseif (!empty($body['results']) && is_array($body['results'])) $items = $body['results'];
            elseif (!empty($body['List']) && is_array($body['List']))   $items = $body['List'];

            $total_api = count($items);
            $preview   = array_slice($items, 0, 5);

            if ($total_api > 0) {
                $msg = '<div class="notice notice-success"><p>✅ Kết nối thành công! Mã phản hồi HTTP: [<strong>'.$code.'</strong>] — Tìm thấy <strong>'.$total_api.'</strong> tin dữ liệu từ API.</p></div>';
            } else {
                $msg = '<div class="notice notice-warning"><p>⚠️ Kết nối thông nhưng danh bạ mảng trống (0 kết quả).</p></div>';
            }
        }
    }
    ?>
    <div class="wrap nks-wrap">
        <h1>⚙️ Cấu hình thông số kết nối API NKS</h1>
        <?php echo $msg; ?>
        <div class="nks-card">
            <form method="post" action="options.php">
                <?php settings_fields('nks_opts'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="nks_api_url">Đường dẫn API URL</label></th>
                        <td>
                            <input type="url" id="nks_api_url" name="nks_api_url" value="<?php echo esc_attr(get_option('nks_api_url','https://online.nks.vn/api/nks/rsitems')); ?>" class="regular-text">
                        </td>
                    </tr>
                    <tr>
                        <th><label for="nks_api_key">Mã Token API Key</label></th>
                        <td>
                            <input type="password" id="nks_api_key" name="nks_api_key" value="<?php echo esc_attr(get_option('nks_api_key')); ?>" class="regular-text" autocomplete="new-password">
                        </td>
                    </tr>
                </table>
                <?php submit_button('💾 Lưu thông số cấu hình'); ?>
            </form>
        </div>

        <div class="nks-card">
            <h3>🔌 Chạy Test luồng dữ liệu</h3>
            <form method="post">
                <?php wp_nonce_field('nks_do_test'); ?>
                <input type="hidden" name="nks_test" value="1">
                <?php submit_button('🔌 Nhấp kiểm tra phản hồi API', 'secondary', 'submit', false); ?>
            </form>

            <?php if (!empty($preview)): ?>
            <table class="nks-tbl">
                <thead>
                    <tr><th>ID</th><th>Tiêu đề Test</th><th>Mức giá</th><th>Loại hình</th></tr>
                </thead>
                <tbody>
                    <?php foreach ($preview as $item): ?>
                    <tr>
                        <td><code><?php echo esc_html($item['id'] ?? '—'); ?></code></td>
                        <td><strong><?php echo esc_html($item['title'] ?? '—'); ?></strong></td>
                        <td style="color:#0077bb; font-weight:bold;"><?php echo esc_html($item['formatedPrice'] ?? '—'); ?></td>
                        <td><span class="nks-badge"><?php echo esc_html($item['rstype'] ?? '—'); ?></span></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
    </div>
    <?php
}

/* ================================================================
   8. XỬ LÝ AJAX ĐỒNG BỘ CỦA WORDPRESS
   ================================================================ */
add_action('wp_ajax_nks_do_sync', 'nks_ajax_sync');
function nks_ajax_sync() {
    check_ajax_referer('nks_sync', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Từ chối quyền.');

    $t0   = microtime(true);
    $url  = get_option('nks_api_url', 'https://online.nks.vn/api/nks/rsitems');
    $key  = get_option('nks_api_key', '');
    $hdrs = ['Content-Type' => 'application/json'];
    if ($key) $hdrs['Authorization'] = 'Bearer ' . $key;

    $res = wp_remote_post($url, [
        'timeout'   => 120, 
        'headers'   => $hdrs, 
        'body'      => json_encode([]), 
        'sslverify' => false
    ]);
    
    if (is_wp_error($res)) wp_send_json_error('Lỗi đường truyền (Timeout): ' . $res->get_error_message());

    $body = json_decode(wp_remote_retrieve_body($res), true);
    
    $items = [];
    if (is_array($body) && isset($body[0]))                     $items = $body;
    elseif (!empty($body['data']) && is_array($body['data']))   $items = $body['data'];
    elseif (!empty($body['items']) && is_array($body['items'])) $items = $body['items'];
    elseif (!empty($body['results']) && is_array($body['results'])) $items = $body['results'];
    elseif (!empty($body['List']) && is_array($body['List']))   $items = $body['List'];

    if (empty($items)) wp_send_json_error('API phản hồi mảng rỗng.');

    $n = 0;
    foreach ($items as $item) {
        if (empty($item['id'])) continue;

        $api_id = trim((string)$item['id']);
        
        $existing_posts = get_posts([
            'post_type'      => 'nks_property',
            'posts_per_page' => 1,
            'post_status'    => ['publish', 'draft', 'pending'],
            'meta_query'     => [
                [
                    'key'     => '_nks_api_id',
                    'value'   => $api_id,
                    'compare' => '='
                ]
            ]
        ]);

        $post_data = [
            'post_title'   => sanitize_text_field($item['title'] ?? 'Tin BĐS #' . $api_id),
            'post_content' => sanitize_textarea_field($item['address'] ?? ''),
            'post_status'  => 'publish',
            'post_type'    => 'nks_property',
        ];

        if (!empty($existing_posts)) {
            $post_id = $existing_posts[0]->ID;
            $post_data['ID'] = $post_id;
            wp_update_post($post_data);
        } else {
            $post_id = wp_insert_post($post_data);
        }

        if ($post_id && !is_wp_error($post_id)) {
            update_post_meta($post_id, '_nks_api_id', $api_id);
            update_post_meta($post_id, '_nks_price', (int)($item['price'] ?? 0));
            update_post_meta($post_id, '_nks_formatted_price', sanitize_text_field($item['formatedPrice'] ?? $item['price_label'] ?? ''));
            update_post_meta($post_id, '_nks_total_area', (float)($item['total_area'] ?? $item['area'] ?? 0));
            update_post_meta($post_id, '_nks_rstype', sanitize_text_field($item['rstype'] ?? $item['type'] ?? ''));
            update_post_meta($post_id, '_nks_bed', (int)($item['bed'] ?? 0));
            update_post_meta($post_id, '_nks_bath', (int)($item['bath'] ?? 0));
            update_post_meta($post_id, '_nks_direction', sanitize_text_field($item['direction'] ?? ''));
            update_post_meta($post_id, '_nks_address', sanitize_text_field($item['address'] ?? ''));
            update_post_meta($post_id, '_nks_phone', sanitize_text_field($item['phone'] ?? ''));
            
            $img_url = esc_url_raw($item['featureimg'] ?? $item['featuring'] ?? '');
            if ($img_url) {
                update_post_meta($post_id, '_nks_api_img_url', $img_url);
            }
            $n++;
        }
    }

    wp_send_json_success([
        'count' => $n,
        'time'  => round(microtime(true) - $t0, 2),
    ]);
}

/* ================================================================
   9. PROXY HÌNH ẢNH DROPBOX TRÊN WP
   ================================================================ */
add_action('wp_ajax_nks_img',        'nks_proxy_img');
add_action('wp_ajax_nopriv_nks_img', 'nks_proxy_img');
function nks_proxy_img() {
    $url = isset($_GET['url']) ? esc_url_raw(urldecode($_GET['url'])) : '';
    if (!$url) { status_header(400); exit; }
    $allowed = ['dropbox.com', 'data.nks.vn', 'online.nks.vn', 'nks.vn'];
    $ok = false;
    foreach ($allowed as $d) { if (strpos($url, $d) !== false) { $ok = true; break; } }
    if (!$ok) { status_header(403); exit; }
    $ck = 'nks_img_' . md5($url);
    $cached = get_transient($ck);
    if ($cached) {
        header('Content-Type: ' . $cached['t']);
        header('Cache-Control: public, max-age=86400');
        echo base64_decode($cached['d']); exit;
    }
    $res = wp_remote_get($url, ['timeout' => 15, 'headers' => [
        'User-Agent' => 'Mozilla/5.0',
        'Referer'    => 'https://www.dropbox.com/'
    ]]);
    if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
        wp_redirect('https://placehold.co/400x260/e8f4fd/0077bb?text=NKS+BDS'); exit;
    }
    $type = wp_remote_retrieve_header($res, 'content-type') ?: 'image/jpeg';
    $body = wp_remote_retrieve_body($res);
    set_transient($ck, ['t' => $type, 'd' => base64_encode($body)], DAY_IN_SECONDS);
    header('Content-Type: ' . $type);
    header('Cache-Control: public, max-age=86400');
    echo $body; exit;
}

add_action('wp_enqueue_scripts', 'nks_enqueue');
function nks_enqueue() {
    wp_enqueue_style('nks-style', NKS_URL . 'assets/style.css', [], NKS_VER);
}

/* ================================================================
   10. SHORTCODE FRONTEND TRÊN WORDPRESS
   ================================================================ */
add_shortcode('nks_bds_compare', 'nks_shortcode');
function nks_shortcode() {
    $query = new WP_Query([
        'post_type'      => 'nks_property',
        'posts_per_page' => -1,
        'post_status'    => 'publish'
    ]);

    if (!$query->have_posts()) {
        return '<div class="nks-empty"><p>Không có dữ liệu hiển thị.</p></div>';
    }

    $ajax = admin_url('admin-ajax.php');
    $data = [];
    $types = [];

    while ($query->have_posts()) {
        $query->the_post();
        $p_id = get_the_ID();
        
        $rstype    = get_post_meta($p_id, '_nks_rstype', true) ?: 'Chưa phân loại';
        $price_f   = get_post_meta($p_id, '_nks_formatted_price', true) ?: 'Liên hệ';
        $area      = get_post_meta($p_id, '_nks_total_area', true);
        $api_img   = get_post_meta($p_id, '_nks_api_img_url', true);
        
        $img_src = '';
        if (has_post_thumbnail()) {
            $img_src = get_the_post_thumbnail_url($p_id, 'medium');
        } elseif ($api_img) {
            $img_src = $ajax . '?action=nks_img&url=' . urlencode($api_img);
        }

        if ($rstype) $types[] = $rstype;

        $data[] = [
            'id'    => (int)$p_id,
            'title' => get_the_title(),
            'price' => $price_f,
            'area'  => $area ? (float)$area : 0,
            'areaF' => $area ? $area . ' m²' : '—',
            'type'  => $rstype,
            'bed'   => (int)get_post_meta($p_id, '_nks_bed', true),
            'bath'  => (int)get_post_meta($p_id, '_nks_bath', true),
            'dir'   => get_post_meta($p_id, '_nks_direction', true) ?: '—',
            'addr'  => get_post_meta($p_id, '_nks_address', true) ?: '—',
            'phone' => get_post_meta($p_id, '_nks_phone', true) ?: '—',
            'img'   => $img_src,
            'link'  => get_permalink(),
        ];
    }
    wp_reset_postdata();

    $types = array_unique(array_filter($types));
    sort($types);

    ob_start();
    ?>
    <div class="nks-app" id="nks-app">
        </div>
    <?php
    return ob_get_clean();
}

/* ================================================================
   11. TỰ ĐỘNG HIỂN THỊ THÔNG SỐ Ở TRANG CHI TIẾT WP
   ================================================================ */
add_filter('the_content', 'nks_append_property_details_to_frontend');
function nks_append_property_details_to_frontend($content) {
    if (is_singular('nks_property') && in_the_loop() && is_main_query()) {
        $post_id   = get_the_ID();
        $price_f   = get_post_meta($post_id, '_nks_formatted_price', true) ?: 'Liên hệ';
        $area      = get_post_meta($post_id, '_nks_total_area', true);
        $rstype    = get_post_meta($post_id, '_nks_rstype', true) ?: 'Chưa phân loại';
        $bed       = get_post_meta($post_id, '_nks_bed', true);
        $bath      = get_post_meta($post_id, '_nks_bath', true);
        $direction = get_post_meta($post_id, '_nks_direction', true) ?: '—';
        $address   = get_post_meta($post_id, '_nks_address', true) ?: '—';
        $phone     = get_post_meta($post_id, '_nks_phone', true) ?: '—';

        $info_html = '
        <div class="nks-frontend-spec-box" style="background:#f8fafc; border:1px solid #e2e8f0; padding:20px; border-radius:10px; margin-bottom:25px;">
            <h4 style="margin-top:0; color:#0077bb;">📊 Thông tin chi tiết bất động sản</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; font-size:14px;">
                <div><strong>💰 Giá:</strong> <span style="color:#0077bb; font-weight:bold;">' . esc_html($price_f) . '</span></div>
                <div><strong>📐 Diện tích:</strong> ' . ($area ? esc_html($area) . ' m²' : '—') . '</div>
                <div><strong>🏢 Phân loại:</strong> ' . esc_html($rstype) . '</div>
                <div><strong>🛏 Phòng ngủ:</strong> ' . esc_html($bed) . '</div>
                <div><strong>🚿 Phòng tắm:</strong> ' . esc_html($bath) . '</div>
                <div><strong>🧭 Hướng:</strong> ' . esc_html($direction) . '</div>
                <div style="grid-column: 1 / -1;"><strong>📍 Địa chỉ:</strong> ' . esc_html($address) . '</div>
            </div>
        </div>';

        return $info_html . $content;
    }
    return $content;
}

/* ================================================================
   12. MỞ CỔNG REST API TRÊN WORDPRESS CHO VERCEL LẤY DỮ LIỆU SẠCH
   ================================================================ */
add_action('rest_api_init', 'nks_register_wp_api_endpoints');
function nks_register_wp_api_endpoints() {
    register_rest_route('nks/v1', '/properties', [
        'methods'             => 'GET',
        'callback'            => 'nks_get_api_properties_callback',
        'permission_callback' => '__return_true', // Cho phép Vercel kết nối công khai
    ]);
}

function nks_get_api_properties_callback($request) {
    $query = new WP_Query([
        'post_type'      => 'nks_property',
        'posts_per_page' => -1,
        'post_status'    => 'publish'
    ]);

    $data = [];
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $p_id = get_the_ID();
            
            $api_id    = get_post_meta($p_id, '_nks_api_id', true);
            $price_f   = get_post_meta($p_id, '_nks_formatted_price', true) ?: 'Liên hệ';
            $area      = get_post_meta($p_id, '_nks_total_area', true);
            $rstype    = get_post_meta($p_id, '_nks_rstype', true) ?: 'Chưa phân loại';
            $api_img   = get_post_meta($p_id, '_nks_api_img_url', true);

            $data[] = [
                'id'            => $api_id ? $api_id : (string)$p_id,
                'title'         => get_the_title(),
                'formatedPrice' => $price_f,
                'price'         => (int)get_post_meta($p_id, '_nks_price', true),
                'total_area'    => $area ? (float)$area : 0,
                'rstype'        => $rstype,
                'bed'           => (int)get_post_meta($p_id, '_nks_bed', true),
                'bath'          => (int)get_post_meta($p_id, '_nks_bath', true),
                'direction'     => get_post_meta($p_id, '_nks_direction', true) ?: '—',
                'address'       => get_post_meta($p_id, '_nks_address', true) ?: '—',
                'phone'         => get_post_meta($p_id, '_nks_phone', true) ?: '—',
                'featureimg'    => $api_img ? $api_img : (has_post_thumbnail() ? get_the_post_thumbnail_url($p_id, 'full') : ''),
            ];
        }
        wp_reset_postdata();
    }

    return new WP_REST_Response($data, 200);
}