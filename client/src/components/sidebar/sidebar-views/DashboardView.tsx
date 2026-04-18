import DashboardModule from "@/components/dashboard/DashboardModule"
import { useAppContext } from "@/context/AppContext"

function DashboardView() {
    const { currentUser } = useAppContext()

    return (
        <div className="w-full h-full overflow-auto">
            <DashboardModule projectId={currentUser.roomId || "default"} />
        </div>
    )
}

export default DashboardView
