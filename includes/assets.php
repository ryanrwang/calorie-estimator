<?php
/**
 * Cache-busting helper for static assets.
 *
 * Appends ?v=<filemtime> to local asset URLs so browsers fetch the new file
 * after a deploy (the FTP deploy updates the mtime of changed files), while
 * still caching unchanged files. No build step required.
 */
function asset_url($file) {
    $path = dirname(__DIR__) . '/' . ltrim($file, '/');
    $mtime = @filemtime($path);
    return $file . ($mtime ? '?v=' . $mtime : '');
}
