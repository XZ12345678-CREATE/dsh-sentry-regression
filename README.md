# 错误复现与回归记录 · dsh-sentry-regression

围绕错误记录复现问题，保存同一测试的修复前后执行证据。

社区预览版 `0.1.0-preview.3`。

## 安装到 DSH 桌面版

打开 DSH 的「插件 → 添加插件」，输入本仓库地址、本地插件目录的绝对路径，或 Release 安装包（.tgz）的绝对路径。点击「安装」，完成后选择「立即启用」。

命令行网页 Profile 用户可在源码根目录执行：

```sh
dsh plugin --profile web add .
```

候选运行基线：Node.js ^22.19.0 或 >=24；DSH >=0.2.1-rc.5 <0.2.2-0。完整 DSH 应用、真实模型与账户仍需实际环境验收；与整套包重复启用同名功能会重复注册。

## 使用

在 DSH 中说：使用 dsh-sentry-regression，根据我提供的项目和资料完成任务，说明实际验证结果。

本插件包含：`dsh-sentry-regression`。

随包程序示例（在源码根目录执行，真实路径按需替换）：

```sh
node scripts/regression-run.mjs compare before.json after.json
```

示例数据仅用于演示。完整工作流在 [dsh-sentry-regression](skills/dsh-sentry-regression/SKILL.md)。

## 运行条件与边界

读取真实 Sentry 需已授权连接器；本地执行需用户测试环境。记录不认证生产因果，也不证明所有间接测试依赖都未变化。

## 源码检查

```sh
npm run check
npm test
npm run pack:plugin
```

这些检查只使用 Node.js 内置模块，Git 测试另需 Git，不要求先安装兄弟插件或总仓库依赖。GitHub Actions 配置检查 macOS/Linux；远端运行尚待首次推送。验证记录见 [VALIDATION.md](VALIDATION.md)。

## 许可

见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)。保留现有第三方版权及许可；可填写自己的维护者身份。独立社区项目，不代表 DeepSeek 或功能参考项目认可。
