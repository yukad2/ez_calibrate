# Repository Guidelines

## プロジェクト構成とモジュール
本リポジトリはスタンドアロンな静的アプリで、エントリーポイントは `index.html`・`display.html`・`remote.html` の3枚です。`index.html` は制御パネルと表示 iframe を同居させ、`display.html` は純粋な表示面、`remote.html` は別ウィンドウ操作に特化しています。スタイルやスクリプトは重複させず、共通化が必要な場合はもっとも更新頻度の高いファイルを基準にコピーしてください。今後アセットを追加する場合は `assets/` 以下にまとめ、相対パスで参照するとローカル/ホスティング双方で手間がかかりません。

## ビルド・テスト・開発コマンド
- `python -m http.server 4173` (ルート実行): `http://localhost:4173/index.html` を開き、別タブで `remote.html` を開くとクロスウィンドウ挙動を確認できます。
- `npm install --global serve && serve .`: HTTPS が必要な場面やカスタムポートを使いたい場合の代替。キャッシュ無効化は行わず、本番挙動を再現してください。

## コーディングスタイルと命名
HTML/CSS/JS は2スペースインデントを維持します。HTML は意味的なタグを優先し、クラス名は BEM 風のハイフン区切り (`control-panel`, `info-box`) を使用します。DOM 参照や状態変数は `camelCase` (`displayFrame`, `remoteWindow`) とし、モダンな素の JavaScript (`const`/`let`, オプショナルチェーン) を採用してください。分岐が複雑になる場合のみ短いコメントを添えます。

## テスト指針
自動テストは未整備のため、以下を手動で検証します。(1) メインパネルから色を設定した際に `display.html` が即応するか、(2) `remote.html` からの画像送信が同期して反映されるか、(3) `BroadcastChannel` が無効な環境（Safari プライベート等）でもフォールバック挙動が破綻しないか。ブラウザ固有の不具合は PR に再現手順付きで記録し、影響箇所へ TODO を残してください。

## コミットとプルリクエスト
コミットは Conventional Commits (`feat: add saturation preset`, `fix: guard missing opener`) に従い、UI とスクリプトの関連変更は同一コミットにまとめてレビュー負荷を下げます。PR には概要、視覚変更時の Before/After 画像、再現/検証手順、テストしたブラウザを記載してください。該当する issue には `Closes #123` を付与し、追跡すべき残タスクはチェックリスト化します。

## セキュリティと設定の注意
任意の画像 URL を受け付けるため、HTTPS ソースを推奨し、混在コンテンツ遮断の可能性を把握しておきます。`postMessage` 受信処理はペイロードの型チェックを厳格に保ち、外部 HTML をインラインで描画しないこと。別オリジンで埋め込む場合はリバースプロキシや CSP を調整し、`display.html` と `remote.html` が信頼できるチャネルのみで通信するよう制御してください。
