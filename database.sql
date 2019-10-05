create database if not exists `openletter`;

use `openletter`;

create table if not exists `metadata` (
    `id` bigint primary key auto_increment,
    `name` varchar(255) not null,
    `val` varchar(255),

    index index_metadata_on_name (`name`)
) character set utf8mb4 collate utf8mb4_unicode_ci;

create table if not exists `users` (
    `id` bigint primary key auto_increment,
    `username` varchar(255) not null,
    `email` varchar(255) not null,
    `password` varchar(255) not null,
    `site_admin` tinyint(1) not null default 0,
    `created_at` datetime not null default current_timestamp,
    `updated_at` datetime not null default current_timestamp,

    constraint unique_users_email unique (`email`),
    index index_users_on_email (`email`)
) character set utf8mb4 collate utf8mb4_unicode_ci;

create table if not exists `signatories` (
    `id` bigint primary key auto_increment,
    `se_acct_id` bigint,
    `display_name` varchar(255),
    `is_moderator` tinyint(1) not null default 0,
    `is_former_moderator` tinyint(1) not null default 0,
    `created_at` datetime not null default current_timestamp,
    `updated_at` datetime not null default current_timestamp,

    constraint unique_signatories_se_acct_id unique (`se_acct_id`),
    index index_signatories_on_se_acct_id (`se_acct_id`),
    index index_signatories_on_display_name (`display_name`)
) character set utf8mb4 collate utf8mb4_unicode_ci;

