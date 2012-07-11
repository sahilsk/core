<?php

/**
* ownCloud
*
* @author Michael Gapczynski
* @copyright 2012 Michael Gapczynski mtgap@owncloud.com
*
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
* License as published by the Free Software Foundation; either
* version 3 of the License, or any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU AFFERO GENERAL PUBLIC LICENSE for more details.
*
* You should have received a copy of the GNU Affero General Public
* License along with this library.  If not, see <http://www.gnu.org/licenses/>.
*/

$config = include('apps/files_external/tests/config.php');
if (!is_array($config) or !isset($config['amazons3']) or !$config['amazons3']['run']) {
	abstract class Test_Filestorage_AmazonS3 extends Test_FileStorage{}
	return;
} else {
	class Test_Filestorage_AmazonS3 extends Test_FileStorage {

		private $config;
		private $id;

		public function setUp() {
			$id = uniqid();
			$this->config = include('apps/files_external/tests/config.php');
			$this->config['amazons3']['bucket'] = $id; // Make sure we have a new empty bucket to work in
			$this->instance = new OC_Filestorage_AmazonS3($this->config['amazons3']);
		}

		public function tearDown() {
			$s3 = new AmazonS3(array('key' => $this->config['amazons3']['key'], 'secret' => $this->config['amazons3']['secret']));
			if ($s3->delete_all_objects($this->id)) {
				$s3->delete_bucket($this->id);
			}
		}
	}
}
