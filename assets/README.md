# Tech assets

3D clay assets for the agent product website. Soft pillow clay, Blender Cycles renders, transparent backgrounds.

Each asset comes as name.png (512px) and name@2x.png (1024px).

Palette: white and black as the main colors. Accents Brume #C2F2E4, Menthe #35C8B4, Limonade #EDF7BE, Verveine #A4CF4A. The mascot is Verveine.

## agents (21)
agent_badge, chat_bubble_done, chat_bubble_working, checkmark_badge, handoff_arrow, lightbulb, loading_ring, magnifying_glass, mascot_at_laptop, mascot_on_cursor, mascot_with_puzzle, mini_mascot_headset, mini_mascot_plain, mini_mascot_round, mini_mascot_square, pause_button, play_button, progress_bar, sparkle_swirl, stop_button, task_checklist

## core (15)
code_brackets, computer_desktop, computer_laptop, cursor_arrow, cursor_hand, key_arrows, key_command, key_enter, key_esc, key_shift, key_space, key_tab, keyboard_small, puzzle_piece, puzzle_pieces_joined

## hardware (10)
battery, chip, database, headphones, mouse, phone, router, server_stack, tablet, usb_drive

## interface (13)
browser_window, checkbox, file_page, folder, location_pin, notification_bell, radio_button, settings_gear, slider, terminal_window, toggle_off, toggle_on, trash_can

## mascot (8)
mascot_error, mascot_sleeping, mascot_success, mascot_thinking, mascot_waiting, mascot_waving, mascot_welcome, mascot_working

## security (11)
circuit_trace, cloud, cloud_upload, key, link_chain, network_nodes, padlock_closed, padlock_open, plug, shield_check, wifi

## shapes (7)
donut_ring, pebble_set, soft_puddle, squiggle_worm, swirl_black, swirl_menthe, tiny_triangles

## Source
source/lib.py, assets.py and run.py rebuild everything with Blender's Python module (bpy). Run: RES=1024 SAMPLES=40 python3 run.py OUT [asset names]
