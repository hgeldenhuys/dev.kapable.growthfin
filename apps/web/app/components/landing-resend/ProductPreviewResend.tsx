import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Users, Mail, BarChart3, Settings, Search, Bell, Plus } from "lucide-react";

export function ProductPreviewResend() {
  return (
    <div className="bg-black py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Modern Sales Infrastructure
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              A powerful interface designed for speed and clarity. 
              Manage your AI SDRs and lead pipelines with ease.
            </p>
          </div>

          <div className="relative group">
            {/* Glow effect behind the portal */}
            <div className="absolute -inset-1 bg-gradient-to-r from-zinc-800 to-zinc-900 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            
            <Card className="relative bg-zinc-950 border-zinc-800 overflow-hidden shadow-2xl">
              {/* Mock Dashboard Header */}
              <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-900/30">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                    <div className="w-4 h-4 bg-black rounded-sm" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span>GrowthFin</span>
                    <span>/</span>
                    <span className="text-white font-medium">Outbound Campaign</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Search className="w-4 h-4 text-zinc-500" />
                  <Bell className="w-4 h-4 text-zinc-500" />
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700" />
                </div>
              </div>

              <div className="flex h-[500px]">
                {/* Mock Sidebar */}
                <div className="w-60 border-r border-zinc-800 p-4 hidden md:block bg-zinc-950">
                  <div className="space-y-1">
                    {[
                      { icon: BarChart3, label: "Overview", active: true },
                      { icon: Users, label: "Lead Lists", active: false },
                      { icon: Mail, label: "Campaigns", active: false },
                      { icon: Settings, label: "Settings", active: false },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          item.active 
                            ? "bg-zinc-800 text-white" 
                            : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mock Content Area */}
                <div className="flex-1 p-8 overflow-hidden bg-zinc-900/10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-semibold text-white">Campaign Performance</h3>
                      <p className="text-sm text-zinc-500 mt-1">Real-time statistics for your AI SDR team.</p>
                    </div>
                    <Button variant="outline" size="sm" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">
                      <Plus className="w-4 h-4 mr-2" />
                      New Campaign
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[
                      { label: "Total Leads", value: "12,482", change: "+12%" },
                      { label: "Meetings Booked", value: "148", change: "+24%" },
                      { label: "Conversion Rate", value: "1.2%", change: "+0.3%" },
                    ].map((stat) => (
                      <Card key={stat.label} className="bg-zinc-950 border-zinc-800 p-4">
                        <div className="text-sm text-zinc-500 mb-1">{stat.label}</div>
                        <div className="text-2xl font-bold text-white mb-2">{stat.value}</div>
                        <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 text-emerald-500 text-[10px]">
                          {stat.change}
                        </Badge>
                      </Card>
                    ))}
                  </div>

                  {/* Mock Chart/Table area */}
                  <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-medium text-white">Recent Activity</div>
                      <div className="text-xs text-zinc-500 underline cursor-pointer">View All</div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-900 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center">
                              <Mail className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                              <div className="text-sm text-white font-medium">Meeting Booked with John Doe</div>
                              <div className="text-xs text-zinc-500">AI SDR: Sarah • 2 hours ago</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 text-zinc-400">
                            Success
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
