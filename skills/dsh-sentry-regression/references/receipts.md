# 回归执行记录

脚本位于技能目录的 `../../scripts/regression-run.mjs`。执行时解析成绝对路径。它直接运行参数数组，不经 shell 拼接；测试进程继承 DSH 执行环境和权限。

在用户已授权的仓库内，新建能复现问题的测试。将下例的路径、issue、测试命令和失败标记替换为本次任务的实际值：

```sh
node /absolute/plugin/scripts/regression-run.mjs run --cwd /absolute/repo --issue APP-123 --phase before --test-file test/bug.test.mjs --expect-failure regression-123 --out /absolute/workspace/before.json -- node --test test/bug.test.mjs
```

失败测试返回非零退出码，同时保留记录，这是预期现象。默认测试进程限时 120 秒；`--timeout-ms` 可设为 1..300000。输出缓冲总量有上限，保存的两个输出尾部各最多 16000 字符；超出执行缓冲会记为基础设施错误。超时中止主要测试进程，不保证监管全部后代进程。

修复源码后：

```sh
node /absolute/plugin/scripts/regression-run.mjs run --cwd /absolute/repo --issue APP-123 --phase after --test-file test/bug.test.mjs --out /absolute/workspace/after.json -- node --test test/bug.test.mjs
node /absolute/plugin/scripts/regression-run.mjs compare /absolute/workspace/before.json /absolute/workspace/after.json
```

可重复提供 `--test-file`，应包含实际决定断言的测试与辅助文件。记录器只核对调用者声明的测试文件，不会发现所有间接依赖。命令、工作目录、issue 和测试文件集合/散列必须相同；执行期间文件也不能变化。测试参数里不应包含凭据。

`failure-to-pass-observed` 是一致性结论，不是来源认证、因果证明或生产环境修复保证。JSON 记录可被手工编辑，不能作为不可伪造的审计凭证。日志去敏是尽力处理，上传 GitHub 前仍应检查内容。
