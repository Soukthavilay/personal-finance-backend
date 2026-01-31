CREATE DATABASE IF NOT EXISTS personal_finance;
USE personal_finance;

CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
    avatar_url TEXT NULL,
    monthly_income_target DECIMAL(12, 2) NULL,
    language VARCHAR(5) NOT NULL DEFAULT 'vi',
    date_format VARCHAR(32) NOT NULL DEFAULT 'YYYY-MM-DD',
    week_start_day TINYINT NOT NULL DEFAULT 1,
    phone VARCHAR(32) NULL,
    gender VARCHAR(16) NULL,
    dob DATE NULL,
    last_login_at DATETIME NULL,
    reset_password_token_hash VARCHAR(64) NULL,
    reset_password_expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('cash', 'bank', 'credit') NOT NULL,
    currency VARCHAR(3) NOT NULL,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_category (user_id, name, type),
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS Transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT,
    wallet_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id),
    FOREIGN KEY (category_id) REFERENCES Categories(id),
    FOREIGN KEY (wallet_id) REFERENCES Wallets(id)
);

CREATE TABLE IF NOT EXISTS Budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    period VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id),
    FOREIGN KEY (category_id) REFERENCES Categories(id)
);

CREATE TABLE IF NOT EXISTS UserDevices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    platform ENUM('ios', 'android') NOT NULL,
    last_seen_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_device_token (token),
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS NotificationPreferences (
    user_id INT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    daily_time VARCHAR(5) NOT NULL DEFAULT '08:00',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
    daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    daily_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    budget_warning_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_daily_sent_on DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id)
);
