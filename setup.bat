@echo off
echo ========================================
echo    AgriVend Backend Setup Script
echo ========================================
echo.

cd C:\Users\Cj\Documents\CAPSTONE_CJ\Agrivend

REM Create backend folder
echo Creating backend folder structure...
mkdir agrivend-backend 2>nul
cd agrivend-backend

REM Create all folders
mkdir server 2>nul
cd server
mkdir config models controllers routes middleware utils uploads 2>nul
cd uploads
mkdir receipts 2>nul
cd ..\..

echo ✅ Folder structure created
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

echo.
echo ========================================
echo ✅ Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Install MongoDB from: https://www.mongodb.com/try/download/community
echo 2. Run: npm run seed
echo 3. Run: npm run dev
echo.
pause