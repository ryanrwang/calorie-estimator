<?php
/**
 * Mock mode helpers — fake API responses and auth bypass for UI testing.
 * Requires session_start() to have been called.
 */

/**
 * Check and apply ?mock=1 / ?mock=0 URL override, then return whether mock mode is active.
 */
function is_mock_mode() {
    // URL toggle overrides config
    if (isset($_GET['mock'])) {
        $_SESSION['mock_mode'] = $_GET['mock'] === '1';
    }

    // Session override takes priority
    if (isset($_SESSION['mock_mode'])) {
        return (bool)$_SESSION['mock_mode'];
    }

    // Fall back to config flag
    $config = require __DIR__ . '/config.php';
    return !empty($config['mock_mode']);
}

/**
 * Check if a database connection is available.
 */
function mock_has_db() {
    try {
        get_db();
        return true;
    } catch (Exception $e) {
        return false;
    }
}

/**
 * Generate a mock calorie estimate response.
 * Returns the response text in the same format as real AI responses.
 */
function mock_generate_response($inputText, $modelId) {
    $foodPool = [
        ['name' => 'Grilled chicken breast', 'low' => 165, 'high' => 220],
        ['name' => 'Brown rice (1 cup)', 'low' => 215, 'high' => 250],
        ['name' => 'Caesar salad', 'low' => 300, 'high' => 450],
        ['name' => 'Banana', 'low' => 90, 'high' => 120],
        ['name' => 'Scrambled eggs (2)', 'low' => 180, 'high' => 240],
        ['name' => 'Slice of pepperoni pizza', 'low' => 280, 'high' => 350],
        ['name' => 'Greek yogurt (6oz)', 'low' => 100, 'high' => 150],
        ['name' => 'Turkey sandwich', 'low' => 350, 'high' => 480],
        ['name' => 'Latte (12oz)', 'low' => 150, 'high' => 200],
        ['name' => 'French fries (medium)', 'low' => 320, 'high' => 420],
        ['name' => 'Salmon fillet (6oz)', 'low' => 280, 'high' => 360],
        ['name' => 'Avocado toast', 'low' => 250, 'high' => 350],
        ['name' => 'Chocolate chip cookie', 'low' => 180, 'high' => 250],
        ['name' => 'Bowl of oatmeal', 'low' => 150, 'high' => 220],
        ['name' => 'Burrito bowl', 'low' => 550, 'high' => 750],
    ];

    $sources = [
        'Source: Mock data for testing.',
        'Source: Estimated from typical preparation.',
        'Source: USDA FoodData Central (mock).',
        'Source: Nutritionix database (mock).',
    ];

    $notes = [
        'Note: Actual calories depend on portion size and preparation method.',
        'Note: Range accounts for variation in serving sizes.',
        'Note: Dressing and toppings can add 50–150 cal.',
        'Note: Cooking method (fried vs baked) significantly affects total.',
        '',
    ];

    // Pick 1-4 random items
    $count = rand(1, 4);
    shuffle($foodPool);
    $items = array_slice($foodPool, 0, $count);

    $totalLow = 0;
    $totalHigh = 0;
    $lines = [];

    foreach ($items as $item) {
        // Add some randomness within the range
        $low = $item['low'] + rand(-15, 15);
        $high = $item['high'] + rand(-15, 15);
        if ($low < 10) $low = 10;
        if ($high <= $low) $high = $low + 30;
        $totalLow += $low;
        $totalHigh += $high;
        $lines[] = $item['name'] . ' — ' . $low . '–' . $high;
    }

    $lines[] = 'Total: ~' . $totalLow . '–' . $totalHigh . ' cal';
    $lines[] = $sources[array_rand($sources)];
    $note = $notes[array_rand($notes)];
    if ($note !== '') {
        $lines[] = $note;
    }

    return implode("\n", $lines);
}
