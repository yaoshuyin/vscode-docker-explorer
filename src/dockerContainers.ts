import * as path from "path";
import * as vscode from "vscode";
import { AppInsightsClient } from "./appInsightsClient";
import { DockerTreeBase } from "./dockerTreeBase";
import { Executor } from "./executor";
import { DockerContainer } from "./Model/DockerContainer";
import { Utility } from "./utility";

export class DockerContainers extends DockerTreeBase<DockerContainer> implements vscode.TreeDataProvider<DockerContainer> {
    private cachedContainerStrings = [];

    constructor(context: vscode.ExtensionContext) {
        super(context);
    }

    public searchContainer(): void {
        AppInsightsClient.sendEvent("searchContainer");
        const interval = Utility.getConfiguration().get<number>("autoRefreshInterval");
        let containerStrings = [];
        if (interval > 0 && this.cachedContainerStrings.length > 0) {
            this.cachedContainerStrings.forEach((containerString) => {
                const items = containerString.split(" ");
                containerStrings.push(`${items[1]} (${items[2]})`);
            });
        } else {
            containerStrings = Executor.execSync("docker -H 192.168.56.106 ps -a --format \"{{.Names}} ({{.Image}})\"").split(/[\r\n]+/g).filter((item) => item);
        }

        vscode.window.showQuickPick(containerStrings, { placeHolder: "Search Docker Container" }).then((containerString) => {
            if (containerString !== undefined) {
                const items = containerString.split(" ");
                this.getContainer(items[0]);
            }
        });
    }

    public getTreeItem(element: DockerContainer): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DockerContainer): Thenable<DockerContainer[]> {
        const containers = [];
        try {
            this.cachedContainerStrings = this.getContainerStrings();
            this.cachedContainerStrings.forEach((containerString) => {
                const items = containerString.split(" ");
                const image = items[3] === "Up" ? "container-on.png" : "container-off.png";
                containers.push(new DockerContainer(
                    items[0],
                    items[1],
                    items[2],
                    this.context.asAbsolutePath(path.join("resources", image)),
                    {
                        command: "docker-explorer.getContainer",
                        title: "",
                        arguments: [items[1]],
                    },
                ));
            });
        } catch (error) {
            if (!DockerTreeBase.isErrorMessageShown) {
                vscode.window.showErrorMessage(`[Failed to list Docker Containers] ${error.stderr}`);
                DockerTreeBase.isErrorMessageShown = true;
            }
        } finally {
            this.setAutoRefresh(this.cachedContainerStrings, this.getContainerStrings);
        }

        return Promise.resolve(containers);
    }

    public getContainer(containerName: string): void {
        Executor.runInTerminal(`docker -H 192.168.56.106 ps -a --filter "name=${containerName}"`);
        AppInsightsClient.sendEvent("getContainer");
    }

    public startContainer(containerName: string): void {
        Executor.runInTerminal(`docker  -H 192.168.56.106 start ${containerName}`);
        AppInsightsClient.sendEvent("startContainer");
    }

    public attachContainer(containerName: string): void {
        Executor.runInTerminal(`docker  -H 192.168.56.106 attach ${containerName}`, true, `attach ${containerName}`);
        AppInsightsClient.sendEvent("attachContainer");
    }

    public stopContainer(containerName: string): void {
        Executor.runInTerminal(`docker  -H 192.168.56.106 stop ${containerName}`);
        AppInsightsClient.sendEvent("stopContainer");
    }

    public restartContainer(containerName: string): void {
        Executor.runInTerminal(`docker -H 192.168.56.106 restart ${containerName}`);
        AppInsightsClient.sendEvent("restartContainer");
    }

    public showContainerStatistics(containerName: string): void {
        Executor.runInTerminal(`docker -H 192.168.56.106 stats ${containerName}`);
        AppInsightsClient.sendEvent("showContainerStatistics");
    }

    public showContainerLogs(containerName: string): void {
        const containerLogsOptions = Utility.getConfiguration().get<string>("containerLogsOptions");
        Executor.runInTerminal(`docker -H 192.168.56.106 logs ${containerName} ${containerLogsOptions}`, true, `logs ${containerName}`);
        AppInsightsClient.sendEvent("showContainerLogs");
    }

    public inspectContainer(containerName: string): void {
        Executor.runInTerminal(`docker -H 192.168.56.106 inspect ${containerName}`);
        AppInsightsClient.sendEvent("inspectContainer");
    }

    public removeContainer(containerName: string): void {
        Executor.runInTerminal(`docker -H 192.168.56.106 rm ${containerName}`);
        AppInsightsClient.sendEvent("removeContainer");
    }

    public executeCommandInContainer(containerName: string): void {
        const command = Utility.getConfiguration().get<string>("executionCommand");
        if (command) {
            Executor.runInTerminal(`docker -H 192.168.56.106 exec ${containerName} ${command}`);
        } else {
            Executor.runInTerminal(`docker -H 192.168.56.106 exec ${containerName} `, false);
        }
        AppInsightsClient.sendEvent("executeCommandInContainer", command ? { executionCommand: command } : {});
    }

    public executeInBashInContainer(containerName: string): void {
        Executor.runInTerminal(`docker -H 192.168.56.106 exec -it ${containerName} bash`, true, containerName);
        AppInsightsClient.sendEvent("executeInBashInContainer");
    }

    private getContainerStrings(): string[] {
        return Executor.execSync("docker -H 192.168.56.106 ps -a --format \"{{.ID}} {{.Names}} {{.Image}} {{.Status}}\"")
            .split(/[\r\n]+/g).filter((item) => item);
    }
}
