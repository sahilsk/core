<?php

// only need filesystem apps
$RUNTIME_APPTYPES=array('filesystem');

// Init owncloud


OCP\JSON::checkLoggedIn();

// Load the files
$dir = isset( $_GET['dir'] ) ? $_GET['dir'] : '';
$dir = \OC\Files\Filesystem::normalizePath($dir);
if (!\OC\Files\Filesystem::is_dir($dir . '/')) {
	header("HTTP/1.0 404 Not Found");
	exit();
}

$data = array();
$baseUrl = OCP\Util::linkTo('files', 'index.php') . '?dir=';

$permissions = \OCA\Files\Helper::getDirPermissions($dir);

// make filelist
$files = \OCA\Files\Helper::getFiles($dir);

$data['directory'] = $dir;
$data['files'] = $files;
$data['permissions'] = $permissions;

OCP\JSON::success(array('data' => $data));
