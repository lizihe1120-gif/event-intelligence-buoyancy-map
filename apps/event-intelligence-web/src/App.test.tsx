import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App";

describe("Event buoyancy map interactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("switches snapshots with buttons and arrow keys", () => {
    render(<App />);

    const planningTab = screen.getByRole("tab", { name: /2024-09-03.*筹划停牌/ });
    fireEvent.click(planningTab);
    expect(planningTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("article", { name: "中国船舶，停牌中" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "中国重工，停牌中" })).toBeInTheDocument();

    fireEvent.keyDown(planningTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /2024-09-19.*预案复牌/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("观察到 +3.32%")).toBeInTheDocument();
  });

  it("supports keyboard focus for company, event and version nodes", () => {
    render(<App />);

    const company = screen.getByRole("article", { name: "中国重工，已终止上市" });
    expect(company).toHaveAttribute("tabindex", "0");
    fireEvent.focus(company);
    expect(screen.getByRole("status")).toHaveTextContent("已终止上市");

    fireEvent.blur(company);
    const event = screen.getByRole("article", { name: /中国船舶换股吸收合并中国重工，已确认，已完成/ });
    expect(event).toHaveAttribute("tabindex", "0");
    fireEvent.focus(event);
    expect(screen.getByRole("status")).toHaveTextContent("混合影响");

    fireEvent.blur(event);
    const unknownTimeVersion = screen.getByRole("article", { name: /版本1，长期市场传闻，实际发生时间未知/ });
    expect(unknownTimeVersion).toHaveAttribute("tabindex", "0");
    fireEvent.focus(unknownTimeVersion);
    expect(screen.getByRole("status")).toHaveTextContent("实际发生时间未知");
  });

  it("renders data-driven liquid stages and highlights the focused relation chain", () => {
    render(<App />);
    (["drifting", "lifting", "approaching", "stable_fusion", "cooling"] as const).forEach((stage) => {
      expect(document.querySelectorAll(`[data-relation-stage="${stage}"]`).length).toBeGreaterThan(0);
    });
    const stableLinks = document.querySelectorAll('[data-relation-stage="stable_fusion"]');
    const coolingLinks = document.querySelectorAll('[data-relation-stage="cooling"]');
    const mixedLinks = document.querySelectorAll('[data-impact="mixed"]');
    const unclearLinks = document.querySelectorAll('[data-impact="unclear"]');
    expect(stableLinks.length).toBeGreaterThan(0);
    expect(coolingLinks.length).toBeGreaterThan(0);
    expect(mixedLinks.length).toBeGreaterThan(0);
    expect(unclearLinks.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-link-id="event-evt-main-cssc-csic-merger-company-cmp-cssc"]')).toHaveAttribute("data-impact", "mixed");
    expect(document.querySelector('[data-link-id="event-evt-main-cssc-csic-merger-company-cmp-power"]')).toHaveAttribute("data-impact", "unclear");

    const mainEvent = screen.getByRole("article", { name: /中国船舶换股吸收合并中国重工，已确认，已完成/ });
    fireEvent.focus(mainEvent);
    const mainLinks = document.querySelectorAll('[data-link-id*="evt-main-cssc-csic-merger"]');
    expect([...mainLinks].some((link) => link.classList.contains("is-highlighted"))).toBe(true);
    expect(document.querySelectorAll(".liquid-link.is-dimmed").length).toBeGreaterThan(0);
  });

  it("keeps suspension, delisting and cooling as independent visual channels", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /2024-09-03.*筹划停牌/ }));
    const suspended = screen.getByRole("article", { name: "中国船舶，停牌中" });
    expect(suspended).toHaveClass("company-bubble--suspended");
    expect(suspended).not.toHaveClass("impact--negative");

    fireEvent.click(screen.getByRole("tab", { name: /2025-09-16.*实施完成/ }));
    const delisted = screen.getByRole("article", { name: "中国重工，已终止上市" });
    expect(delisted).toHaveClass("company-bubble--delisted");
    expect(delisted).not.toHaveClass("relation--cooling");
    expect(screen.getByRole("article", { name: /中国动力拟购中船柴油机16.5136%股权后终止/ })).toHaveClass("relation--cooling");
  });

  it("keeps all five static relation cues when reduced motion is requested", () => {
    window.history.replaceState({}, "", "/?motion=reduce");
    render(<App />);
    expect(screen.getByRole("main")).toHaveAttribute("data-motion-preference", "reduce");
    (["drifting", "lifting", "approaching", "stable_fusion", "cooling"] as const).forEach((stage) => {
      expect(document.querySelector(`[data-relation-stage="${stage}"]`)).toHaveAttribute("data-shape-cue");
    });
  });

  it("opens the read-only seven-step analysis process and closes with Escape", () => {
    render(<App />);
    const trigger = screen.getByRole("button", { name: "查看分析过程" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "本次情报如何生成" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(15);
    expect(dialog).toHaveTextContent("Agent 来源快照");
    expect(dialog).toHaveTextContent("应用到事件浮力图");
    expect(dialog).toHaveTextContent("iFinD 和扶摇当前不可用");
    expect(screen.queryByRole("button", { name: /接受|批准|确认结论/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens all four event details without adding review controls", () => {
    render(<App />);
    const eventNames = [
      /中国船舶换股吸收合并中国重工，已确认，已完成/,
      /主合并触发中国动力权益承继变化/,
      /中国动力拟购中船柴油机16.5136%股权后终止/,
      /中国船舶集团调整解决同业竞争承诺/
    ];
    eventNames.forEach((name) => {
      fireEvent.click(screen.getByRole("article", { name }));
      expect(screen.getByRole("dialog", { name: /事件详情|中国船舶|主合并|中国动力/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /确认结论|接受聚类|修改权重/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "关闭事件详情" }));
    });
  });

  it("opens a version at the correct full-timeline card and supports keyboard tabs and Escape", () => {
    render(<App />);
    const version = screen.getByRole("article", { name: /版本1，长期市场传闻，实际发生时间未知/ });
    version.focus();
    fireEvent.keyDown(version, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const versionsTab = screen.getByRole("tab", { name: "版本演化" });
    expect(versionsTab).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("detail-evt-main-cssc-csic-merger-v1")).toHaveClass("is-selected");

    fireEvent.keyDown(versionsTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "证据与冲突" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(version).toHaveFocus();
  });

  it("opens external sources safely and keeps claim labels visible", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("article", { name: /中国船舶换股吸收合并中国重工，已确认，已完成/ }));
    fireEvent.click(screen.getByRole("tab", { name: "证据与冲突" }));
    expect(screen.getByText("已确认事实")).toBeInTheDocument();
    expect(screen.getByText("机构或专家观点")).toBeInTheDocument();
    expect(screen.getByText("基于材料的推测")).toBeInTheDocument();
    expect(screen.getByText("尚未证实的传闻")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "原文 ↗" });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("keeps unread notifications constrained by the active snapshot", () => {
    render(<App />);
    const trigger = screen.getByRole("button", { name: /事件更新.*15条未读/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "结论变化与站内通知" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /真实事件更新.*15/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /2024-09-03.*筹划停牌/ }));
    expect(screen.getByRole("tab", { name: /真实事件更新.*3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /事件更新.*3条未读/ })).toBeInTheDocument();
    expect(screen.queryByText(/监管注册完成/)).not.toBeInTheDocument();
    expect(screen.queryByText(/终止上市与换股实施完成/)).not.toBeInTheDocument();
  });

  it("marks notifications read, restores demo state and persists IDs only", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /事件更新.*15条未读/ }));
    fireEvent.click(screen.getByRole("button", { name: "全部标记已读" }));
    expect(screen.getByRole("button", { name: /事件更新.*0条未读/ })).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem("event-intelligence:notification-read:v1") ?? "{}") as Record<string, unknown>;
    expect(Object.keys(stored)).toHaveLength(15);
    expect(Object.values(stored).every((value) => value === true)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "恢复初始演示状态" }));
    expect(screen.getByRole("button", { name: /事件更新.*15条未读/ })).toBeInTheDocument();
    expect(window.localStorage.getItem("event-intelligence:notification-read:v1")).toBeNull();
  });

  it("opens a real notification at its event version and keeps rule samples isolated", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /事件更新/ }));
    const notificationDialog = screen.getByRole("dialog", { name: "结论变化与站内通知" });
    const heading = within(notificationDialog).getByRole("heading", { name: /实施完成：终止上市与换股实施完成/ });
    const card = heading.closest("article");
    if (!card) throw new Error("Notification card not found");
    fireEvent.click(within(card).getByRole("button", { name: "查看版本与依据" }));
    expect(screen.getByRole("tab", { name: "版本演化" })).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("detail-evt-main-cssc-csic-merger-v7")).toHaveClass("is-selected");
    fireEvent.keyDown(window, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: /事件更新/ }));
    fireEvent.click(screen.getByRole("tab", { name: /状态规则样例/ }));
    expect(screen.getByText(/不计入真实事件、来源或未读数量/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "查看规则说明" })[0]!);
    expect(screen.getAllByText("规则演示样例，不属于中国船舶真实事件数据。").length).toBeGreaterThan(0);
    expect(screen.queryByRole("tab", { name: "版本演化" })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "结论变化与站内通知" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
